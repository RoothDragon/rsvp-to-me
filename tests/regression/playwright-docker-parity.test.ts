// Regression: #733 / 01a150ee, found 2026-10-19.
// Root cause: local preflight skipped CI's Docker browser check, so a stale
// Playwright image pin passed locally while CI rejected the installed version.

import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");
const helperPath = "scripts/check-playwright-docker.sh";
const image = "mcr.microsoft.com/playwright:v1.64.0-noble";

function runFixture(version: string, dockerStatus = 0) {
  const fixture = mkdtempSync(join(tmpdir(), "playwright-docker-parity-"));
  try {
    mkdirSync(join(fixture, "scripts"));
    mkdirSync(join(fixture, "bin"));
    writeFileSync(join(fixture, helperPath), readFileSync(join(REPO_ROOT, helperPath)));
    writeFileSync(join(fixture, "scripts/run-e2e-docker.sh"), `PLAYWRIGHT_IMAGE=${image}\n`);
    const executables = {
      git: '#!/bin/bash\nprintf "%s\\n" "$PWD"\n',
      node: '#!/bin/bash\nprintf "%s\\n" "$FIXTURE_VERSION"\n',
      docker:
        '#!/bin/bash\nprintf "%s\\n" "$@" > "$PWD/docker-args"\nexit "$FIXTURE_DOCKER_STATUS"\n',
    };
    for (const [name, source] of Object.entries(executables)) {
      writeFileSync(join(fixture, "bin", name), source, { mode: 0o755 });
    }
    const result = spawnSync("bash", [helperPath], {
      cwd: fixture,
      env: {
        ...process.env,
        PATH: `${join(fixture, "bin")}:${process.env.PATH}`,
        FIXTURE_VERSION: version,
        FIXTURE_DOCKER_STATUS: String(dockerStatus),
      },
      encoding: "utf8",
      timeout: 5_000,
    });
    let dockerArgs: string[] | undefined;
    try {
      dockerArgs = readFileSync(join(fixture, "docker-args"), "utf8").trimEnd().split("\n");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return { result, dockerArgs, fixture };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

describe("Playwright Docker parity", () => {
  it("rejects a version mismatch before invoking Docker", () => {
    const { result, dockerArgs } = runFixture("1.65.0");
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain("must match installed @playwright/test 1.65.0");
    expect(dockerArgs).toBeUndefined();
  });

  it("uses the matching image with an isolated read-only browser smoke test", () => {
    const { result, dockerArgs, fixture } = runFixture("1.64.0");
    expect(result.error).toBeUndefined();
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(dockerArgs?.slice(0, 13)).toEqual([
      "run",
      "--rm",
      "--init",
      "--ipc=host",
      "--network",
      "none",
      "--volume",
      `${fixture}:/app:ro`,
      "--workdir",
      "/app",
      image,
      "node",
      "-e",
    ]);
  });

  it("propagates Docker browser failures", () => {
    const { result, dockerArgs } = runFixture("1.64.0", 42);
    expect(result.error).toBeUndefined();
    expect(dockerArgs).toBeDefined();
    expect(result.status).toBe(42);
  });

  it("runs the shared gate in CI and before preflight's fast-mode exit", () => {
    const ci = readFileSync(join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");
    const preflight = readFileSync(join(REPO_ROOT, "scripts/preflight.sh"), "utf8");
    const browserStep = ci
      .split("- name: Verify Playwright Docker browser")[1]
      ?.split("- name:")[0];
    expect(browserStep).toContain(helperPath);
    const invocation = preflight.indexOf(`\n${helperPath}\n`);
    expect(invocation).toBeGreaterThan(preflight.indexOf('ok "deps ready"'));
    expect(invocation).toBeLessThan(preflight.indexOf('if [ "$FAST" = 1 ]'));
  });
});
