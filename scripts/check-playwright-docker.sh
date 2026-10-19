#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(git rev-parse --show-toplevel)"

# Exercise the image used by the Docker helper, including its browser binaries.
image=$(awk -F= '$1 == "PLAYWRIGHT_IMAGE" { print $2 }' scripts/run-e2e-docker.sh)
version=$(node -p "require('@playwright/test/package.json').version")
if [ "$image" != "mcr.microsoft.com/playwright:v$version-noble" ]; then
  echo "::error::Playwright Docker image must match installed @playwright/test $version"
  exit 1
fi
docker run --rm --init --ipc=host --network none \
  --volume "$PWD:/app:ro" --workdir /app "$image" node -e '
    const { chromium, expect } = require("@playwright/test");
    (async () => {
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        await page.setContent("<button>RSVP</button>");
        const button = page.getByRole("button", { name: "RSVP" });
        await expect(button).toBeVisible();
        await button.click();
        if (!(await page.screenshot()).length) throw new Error("Empty screenshot");
        console.log("Playwright Docker browser passed: Chromium " + browser.version());
      } finally {
        await browser.close();
      }
    })().catch(error => { console.error(error); process.exit(1); });
  '
