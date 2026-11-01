// Root cause (October 2026): preflight published disposable database/cache ports
// on every interface, unsafe when running validation on a shared EC2 host.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("preflight test-service exposure", () => {
  it("binds both disposable services to loopback before running tests", () => {
    // A shell function captures Docker calls and stops at Redis startup. No real
    // Docker executable, service, network, or database is used by this test.
    const result = spawnSync(
      "bash",
      [
        "-c",
        `
      exec 3>&2
      docker() {
        if [ "$1" = create ]; then printf 'CAPTURE:%s\\n' "$*" >&2; fi
        case "$*" in *postgres:18-alpine*) echo owned-postgres-id;; *redis:7-alpine*) return 77;; esac
        if [ "$1" = rm ]; then printf 'CLEANUP:%s\\n' "$*" >&3; fi
        return 0
      }
      export -f docker
      source scripts/preflight.sh
    `,
      ],
      { cwd: resolve(__dirname, "../.."), encoding: "utf8", timeout: 10000 }
    );
    expect(result.error).toBeUndefined();
    expect(result.status, result.stdout + result.stderr).toBe(77);
    expect(result.stderr).toMatch(
      /CAPTURE:create .* -p 127\.0\.0\.1:55432:5432 postgres:18-alpine/
    );
    expect(result.stderr).toMatch(/CAPTURE:create .* -p 127\.0\.0\.1:56399:6379 redis:7-alpine/);
    expect(result.stderr).toContain("CLEANUP:rm -fv owned-postgres-id");
    expect(result.stderr).not.toContain("preflight-pg");
    expect(result.stderr).not.toContain("preflight-redis");
  });
});
