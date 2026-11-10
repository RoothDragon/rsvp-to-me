/**
 * Root cause (01a1c421, November 2026): profile photos used the event-image
 * endpoint, whose HOST/ADMIN gate rejected signed-in GUEST accounts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("fs/promises", () => ({ writeFile: vi.fn(), mkdir: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/captcha", () => ({
  assertCaptcha: vi.fn(),
  CaptchaVerificationError: class extends Error {},
}));

import { writeFile } from "fs/promises";
import { getSession } from "@/lib/session";
import { assertCaptcha, CaptchaVerificationError } from "@/lib/captcha";
import { CAPTCHA_RESPONSE_FIELD } from "@/lib/captcha-types";
import { POST } from "@/app/api/upload/route";

function request(purpose = "avatar", bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])) {
  const form = new FormData();
  form.append("file", new File([bytes], "photo.jpg", { type: "image/jpeg" }));
  form.append(CAPTCHA_RESPONSE_FIELD, "captcha-token");
  return new NextRequest(`http://localhost:3000/api/upload?purpose=${purpose}`, {
    method: "POST",
    body: form,
  });
}

describe("profile avatar upload permissions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      userId: "guest-1",
      email: "guest@example.com",
      role: "GUEST",
    });
    vi.mocked(assertCaptcha).mockResolvedValue(undefined);
  });

  it.each(["GUEST", "HOST", "ADMIN"] as const)("allows a signed-in %s avatar", async (role) => {
    vi.mocked(getSession).mockResolvedValue({ userId: "user-1", email: "user@example.com", role });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).url).toMatch(/^\/api\/uploads\/.+\.jpg$/);
    expect(assertCaptcha).toHaveBeenCalledWith("image_upload", "captcha-token");
    expect(writeFile).toHaveBeenCalledOnce();
  });

  it("rejects anonymous avatar uploads before writing", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it.each(["", "event", "unknown"])(
    "keeps guest uploads restricted for purpose %s",
    async (purpose) => {
      expect((await POST(request(purpose))).status).toBe(401);
      expect(writeFile).not.toHaveBeenCalled();
    }
  );

  it("rejects an invalid CAPTCHA without writing", async () => {
    vi.mocked(assertCaptcha).mockRejectedValue(new CaptchaVerificationError());
    expect((await POST(request())).status).toBe(400);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("rejects non-image bytes despite a JPEG filename and MIME type", async () => {
    const response = await POST(request("avatar", new Uint8Array([1, 2, 3, 4])));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Images only");
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("rejects avatars larger than 8 MB", async () => {
    expect((await POST(request("avatar", new Uint8Array(8 * 1024 * 1024 + 1)))).status).toBe(400);
    expect(writeFile).not.toHaveBeenCalled();
  });
});
