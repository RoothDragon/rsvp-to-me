// Regression: de78391d (QC of #755/#758), found 2026-10-25.
// Root cause: CI type-checks the standalone email worker, which the root
// tsconfig excludes, but local preflight only ran the root `tsc` and a wrangler
// bundle dry run (which does not type-check). A worker type error could pass the
// local CI-parity gate and fail only in CI.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");

describe("email worker type-check parity", () => {
  it("runs CI's worker type-check command before preflight's fast-mode exit", () => {
    const ci = readFileSync(join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");
    const preflight = readFileSync(join(REPO_ROOT, "scripts/preflight.sh"), "utf8");
    const command = ci
      .split("- name: Type-check email worker")[1]
      ?.split("- name:")[0]
      .match(/run:\s*(.+)/)?.[1]
      ?.trim();
    expect(command).toMatch(/^npx tsc .*worker\/worker\.ts$/);
    const invocation = preflight.indexOf(`\n${command}\n`);
    expect(invocation).toBeGreaterThan(preflight.indexOf('ok "deps ready"'));
    expect(invocation).toBeLessThan(preflight.indexOf('if [ "$FAST" = 1 ]'));
  });
});
