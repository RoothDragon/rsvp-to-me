#!/usr/bin/env bash
# Standalone host orchestrator. Does not modify reviewed repository sources.
set -Eeuo pipefail
umask 077
RUN=$(realpath -- "${1:?Usage: bash docker-validation.sh /apps/validation/rsvp-01a18e04/snapshot.34e5d36.XXXXXXXX}")
case "$RUN" in /apps/validation/rsvp-01a18e04/snapshot.34e5d36.*) ;; *) echo 'Refusing a non-temporary source directory' >&2; exit 1;; esac
test -f "$RUN/SOURCE-FILES.sha256"
test -f "$RUN/COMMITTED-FILES.sha256"
# Clean host environment: force local daemon, no context, Docker config, or shell injection.
# Invoke this script with env -i as documented, not from an inherited application env.
test "${DOCKER_HOST:-}" = unix:///var/run/docker.sock
unset DOCKER_CONTEXT DOCKER_TLS_VERIFY DOCKER_CERT_PATH
export DOCKER_CONFIG="$HOME/.docker"
cd "$RUN"
sha256sum -c SOURCE-FILES.sha256
sha256sum -c COMMITTED-FILES.sha256
grep -Fx 'format=rsvp-committed-source-v2' VALIDATION-SNAPSHOT.txt
grep -Fx 'commit=34e5d3690d804a345c0c8fddff6125ec3393c1d9' VALIDATION-SNAPSHOT.txt
grep -Fx 'tree=5ea69d09961a709f15b1181e007116e3345c16d3' VALIDATION-SNAPSHOT.txt
grep -Fx 'branch=wip/verified-guest-rsvp-validation' VALIDATION-SNAPSHOT.txt
test -z "$(find . -path ./.git -prune -o -name '.env*' ! -name '.env.example' -print)"
# Only source links are checked before dependencies introduce normal executable symlinks.
test -z "$(find . -path ./.git -prune -o -type l -print)"
command -v docker >/dev/null
docker info >/dev/null
# Disk admission checks: never put dependencies/browser/build outputs on host /tmp.
check_disk() {
  local path="$1" minimum="$2" kind available
  kind=$(findmnt -n -o FSTYPE -T "$path")
  case "$kind" in tmpfs|ramfs|overlay) echo "Refusing non-disk storage: $path ($kind)" >&2; exit 1;; esac
  available=$(df -Pk "$path" | awk 'NR==2 {print $4}')
  [ "$available" -ge "$minimum" ] || { echo "Insufficient free disk at $path (KiB=$available)" >&2; exit 1; }
}
DOCKER_ROOT=$(docker info --format '{{.DockerRootDir}}')
# /apps is the dedicated XFS data filesystem; inspect no application directories.
test "$(findmnt -n -o TARGET -T /apps)" = /apps
test "$(findmnt -n -o FSTYPE -T /apps)" = xfs
check_disk "$DOCKER_ROOT" 8388608 # 8 GiB image/layer headroom on / (11 GiB reported available)
check_disk /apps 12582912 # 12 GiB bulk-work headroom (19 GiB currently available)
# Refuse symlink redirection before creating the approved validation-only hierarchy.
for path in /apps/validation /apps/validation/rsvp-01a18e04; do
  test ! -L "$path" || { echo "Refusing symlink: $path" >&2; exit 1; }
  if [ -e "$path" ]; then test -d "$path"; else mkdir -- "$path"; fi
done
STORAGE=/apps/validation/rsvp-01a18e04
test "$(realpath -- "$STORAGE")" = "$STORAGE"
SCRATCH=$(mktemp -d "$STORAGE/run.XXXXXXXX")
mkdir -- "$SCRATCH/app" "$SCRATCH/home" "$SCRATCH/tmp" "$SCRATCH/logs" \
  "$SCRATCH/apt-cache" "$SCRATCH/apt-lists" "$SCRATCH/postgres" "$SCRATCH/redis"
OUTPUT="$SCRATCH/logs"
TOOL_ID= PG_ID= REDIS_ID= BROWSER_ID= PG_SETUP_ID= SITEVERIFY_ID= NET_ID=
cleanup() {
  rc=$?
  trap - EXIT INT TERM
  # Only immutable IDs returned by our successful creates; no names or prune commands.
  # /apps run directories are intentionally retained; never recursively delete host data.
  for id in "$SITEVERIFY_ID" "$BROWSER_ID" "$REDIS_ID" "$PG_ID" "$PG_SETUP_ID" "$TOOL_ID"; do
    if [ -n "$id" ]; then
      docker logs "$id" >"$OUTPUT/$id.log" 2>&1 || true
      docker rm -fv "$id" >/dev/null || rc=1
    fi
  done
  if [ -n "$NET_ID" ]; then docker network rm "$NET_ID" >/dev/null || rc=1; fi
  echo "Validation run retained: $SCRATCH; logs: $OUTPUT; source snapshot unchanged: $RUN"
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Image operations only: do not upgrade/install anything on the host.
docker image inspect node:22-bookworm >/dev/null
NODE_IMAGE=$(docker image inspect node:22-bookworm --format '{{.Id}}')
docker pull postgres:18-alpine
docker pull redis:7-alpine
PG_IMAGE=$(docker image inspect postgres:18-alpine --format '{{.Id}}')
REDIS_IMAGE=$(docker image inspect redis:7-alpine --format '{{.Id}}')
NET_ID=$(docker network create --driver bridge --label rsvp.validation=01a18e04 "rsvp-01a18e04-${SCRATCH##*.}")
TOOL_ID=$(docker create --init --label rsvp.validation=01a18e04 \
  --network "$NET_ID" --shm-size=256m --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 --log-opt compress=true \
  --mount "type=bind,src=$RUN,dst=/source,readonly" \
  --mount "type=bind,src=$SCRATCH/app,dst=/app" \
  --mount "type=bind,src=$SCRATCH/home,dst=/validation-home" \
  --mount "type=bind,src=$SCRATCH/tmp,dst=/validation-tmp" \
  --mount "type=bind,src=$SCRATCH/apt-cache,dst=/var/cache/apt" \
  --mount "type=bind,src=$SCRATCH/apt-lists,dst=/var/lib/apt/lists" \
  --mount "type=bind,src=$OUTPUT,dst=/validation-output" \
  --workdir /app \
  -e HOME=/validation-home -e NPM_CONFIG_CACHE=/validation-home/npm-cache \
  -e PLAYWRIGHT_BROWSERS_PATH=/validation-home/ms-playwright -e TMPDIR=/validation-tmp -e TMP=/validation-tmp -e TEMP=/validation-tmp \
  -e AWS_EC2_METADATA_DISABLED=true -e AWS_CONFIG_FILE=/dev/null -e AWS_SHARED_CREDENTIALS_FILE=/dev/null \
  -e NEXT_TELEMETRY_DISABLED=1 -e WRANGLER_SEND_METRICS=false \
  "$NODE_IMAGE" sleep infinity)
docker start "$TOOL_ID" >/dev/null
# No Docker socket, host HOME, env files, credentials, or existing volumes mounted.
# Download/audit phase has internet, but no test DBs exist and no real DB URL is supplied.
# Populate only our new /apps validation workspace with verified regular source files.
# No host dependencies, build outputs, or .git metadata are copied.
docker exec -i "$TOOL_ID" node <<'COPY_SOURCE'
const fs=require("fs"),path=require("path"),crypto=require("crypto");
const manifest=fs.readFileSync("/source/SOURCE-FILES.sha256","utf8");
for(const line of manifest.trimEnd().split("\n")){
  const hash=line.slice(0,64),name=line.slice(66);
  if(!/^[a-f0-9]{64}$/.test(hash)||path.posix.isAbsolute(name)||name.split("/").includes(".."))throw Error("Unsafe source manifest");
  const src="/source/"+name,dst="/app/"+name,stat=fs.lstatSync(src);
  if(!stat.isFile())throw Error("Non-regular source");
  const data=fs.readFileSync(src);
  if(crypto.createHash("sha256").update(data).digest("hex")!==hash)throw Error("Source checksum mismatch");
  fs.mkdirSync(path.dirname(dst),{recursive:true});fs.writeFileSync(dst,data,{mode:stat.mode&0o777});
}
fs.copyFileSync("/source/SOURCE-FILES.sha256","/app/SOURCE-FILES.sha256");
COPY_SOURCE
# Check supported stable semantic versions before installing dependencies.
# .nvmrc remains the preferred version, not an exact Docker runtime requirement.
docker exec -i "$TOOL_ID" node <<'RUNTIME_CHECK'
// BEGIN_RUNTIME_PREDICATES
function stableVersion(value) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(value);
  if (!match) return null; // Reject malformed versions and prereleases.
  const parts = match.slice(1, 4).map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}
function compareVersion(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}
function acceptsNode(value) {
  const version = stableVersion(value);
  return !!version && compareVersion(version, [22, 23, 1]) >= 0 && compareVersion(version, [23, 0, 0]) < 0;
}
function acceptsNpm(value) {
  const version = stableVersion(value);
  return !!version && version[0] === 10 && version[1] === 9;
}
// END_RUNTIME_PREDICATES
const nodeVersion = process.versions.node;
const npmVersion = require("child_process").execFileSync("npm", ["--version"], {encoding: "utf8"}).trim();
console.log(`Runtime: Node ${nodeVersion}; npm ${npmVersion}`);
if (!acceptsNode(nodeVersion) || !acceptsNpm(npmVersion)) {
  console.error("Required: stable Node >=22.23.1 <23 and stable npm 10.9.x; stop for runtime review.");
  process.exit(1);
}
RUNTIME_CHECK
docker exec "$TOOL_ID" bash -euo pipefail -c '
  mkdir -p /validation-tmp
  command -v git; command -v setsid
  node --version; npm --version
  git config --global --add safe.directory /app
  git init -q .
  npm ci
  npm audit --omit=dev --audit-level=high
  npm ci --prefix worker
  npm audit --prefix worker --omit=dev --audit-level=high
  npm audit --audit-level=high || echo "NONBLOCKING: root build-tool advisories"
  npm audit --prefix worker --audit-level=high || echo "NONBLOCKING: worker build-tool advisories"
  npx --no-install playwright install --with-deps chromium
'
# External gate: only the immutable Siteverify suite, never the application or DB setup.
# Runs before PostgreSQL/Redis exist. The main Node runner is disconnected below.
# https://developers.cloudflare.com/turnstile/troubleshooting/testing/
mkdir -- "$SCRATCH/siteverify"
mkdir -- "$SCRATCH/siteverify/node_modules"
cp -- tests/integration/captcha-siteverify.test.ts "$SCRATCH/siteverify/captcha-siteverify.test.ts"
cmp -- tests/integration/captcha-siteverify.test.ts "$SCRATCH/siteverify/captcha-siteverify.test.ts"
cat >"$SCRATCH/siteverify/vitest.config.mjs" <<'SITEVERIFY_CONFIG'
// Plain ESM: --configLoader native imports without bundling into node_modules/.vite-temp.
export default {
  root: "/external",
  cacheDir: "/external-runtime/vite-cache",
  test: {
    include: ["captcha-siteverify.test.ts"],
    environment: "node",
    // Vitest 5 has a separate filesystem module cache, independent of Vite cacheDir.
    fsModuleCache: true,
    fsModuleCachePath: "/external-runtime/vitest-module-cache",
    setupFiles: ["./siteverify-guard.mjs"],
    globalSetup: [],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
};
SITEVERIFY_CONFIG
cat >"$SCRATCH/siteverify/siteverify-guard.mjs" <<'SITEVERIFY_GUARD'
const endpoint = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const secrets = new Set([
  "1x0000000000000000000000000000000AA",
  "2x0000000000000000000000000000000AA",
  "3x0000000000000000000000000000000AA",
]);
const realFetch = globalThis.fetch;
globalThis.fetch = (url, init = {}) => {
  if (String(url) !== endpoint || init.method !== "POST" ||
      !secrets.has(init.body?.get?.("secret")) ||
      init.body?.get?.("response") !== "XXXX.DUMMY.TOKEN.XXXX") {
    throw new Error("External gate permits only Siteverify POSTs with documented dummy credentials");
  }
  return realFetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(15000) });
};
SITEVERIFY_GUARD
# Permit the unprivileged node user to read only this new staging directory.
chmod 0755 "$SCRATCH/siteverify" "$SCRATCH/siteverify/node_modules"
chmod 0644 "$SCRATCH/siteverify/"*.ts "$SCRATCH/siteverify/"*.mjs
# Dedicated writable disk-backed runtime area, owned by the image's unprivileged node user.
# Prepare through the existing /validation-tmp mount; never chown the entire workspace.
docker exec "$TOOL_ID" sh -ec '
  test ! -e /validation-tmp/siteverify
  test ! -L /validation-tmp/siteverify
  mkdir /validation-tmp/siteverify
  chown node:node /validation-tmp/siteverify
  chmod 0700 /validation-tmp/siteverify
'
SITEVERIFY_ID=$(docker create --init --label rsvp.validation=01a18e04 \
  --network "$NET_ID" --user node --read-only --cap-drop ALL \
  --security-opt no-new-privileges \
  --tmpfs /tmp:rw,nosuid,nodev,size=64m,mode=1777 \
  --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 --log-opt compress=true \
  --mount "type=bind,src=$SCRATCH/siteverify,dst=/external,readonly" \
  --mount "type=bind,src=$SCRATCH/app/node_modules,dst=/external/node_modules,readonly" \
  --mount "type=bind,src=$SCRATCH/tmp/siteverify,dst=/external-runtime" \
  --workdir /external -e HOME=/external-runtime/home \
  -e TMPDIR=/external-runtime/tmp -e TMP=/external-runtime/tmp -e TEMP=/external-runtime/tmp \
  -e NODE_ENV=test -e AWS_EC2_METADATA_DISABLED=true \
  "$NODE_IMAGE" bash -euo pipefail -c '
    mkdir -p "$HOME" "$TMPDIR" /external-runtime/vite-cache /external-runtime/vitest-module-cache
    # These checks run as node, before Vite loads anything.
    test -w /external-runtime/vite-cache
    test -w /external-runtime/vitest-module-cache
    test ! -w /external
    test ! -w /external/node_modules
    vitest_status=0
    node node_modules/vitest/vitest.mjs run --config vitest.config.mjs --configLoader native --reporter=json --outputFile=/external-runtime/siteverify.json || vitest_status=$?
    SITEVERIFY_VITEST_EXIT="$vitest_status" node -e '\''
      const r=require("/external-runtime/siteverify.json");
      for (const suite of r.testResults ?? []) {
        if (suite.message) console.error(suite.name + "\n" + suite.message);
        for (const test of suite.assertionResults ?? []) {
          for (const message of test.failureMessages ?? []) console.error(message);
        }
      }
      if(process.env.SITEVERIFY_VITEST_EXIT!=="0" || r.numTotalTests!==3 || r.numPassedTests!==3 || r.numFailedTests!==0 || !r.success) {
        throw Error("External Siteverify gate requires exactly three passing tests");
      }
      console.log("EXTERNAL SITEVERIFY: PASSED 3/3 (documented dummy credentials)");
    '\''
  ')
echo 'EXTERNAL SITEVERIFY: running separately; offline integration excludes these three tests'
docker start "$SITEVERIFY_ID" >/dev/null
SITEVERIFY_EXIT=$(docker wait "$SITEVERIFY_ID")
docker logs "$SITEVERIFY_ID" >"$OUTPUT/siteverify.log" 2>&1
cat "$OUTPUT/siteverify.log"
if [ "$SITEVERIFY_EXIT" != 0 ]; then
  echo "EXTERNAL SITEVERIFY: FAILED (container exit $SITEVERIFY_EXIT); see $OUTPUT/siteverify.log" >&2
  exit 1
fi
# Remove the external runner by its own captured ID; never reconnect the offline runner.
docker rm -fv "$SITEVERIFY_ID" >/dev/null
SITEVERIFY_ID=""
# Verify installed Playwright version against the repository image pin, on the host.
BROWSER_IMAGE=$(awk -F= '$1 == "PLAYWRIGHT_IMAGE" { print $2 }' scripts/run-e2e-docker.sh)
BROWSER_IMAGE=${BROWSER_IMAGE%$'\r'}
VERSION=$(docker exec "$TOOL_ID" node -p 'require("@playwright/test/package.json").version')
test "$BROWSER_IMAGE" = "mcr.microsoft.com/playwright:v$VERSION-noble"
docker pull "$BROWSER_IMAGE"
BROWSER_DIGEST=$(docker image inspect "$BROWSER_IMAGE" --format '{{.Id}}')
BROWSER_ID=$(docker create --init --network none --shm-size=256m --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 --log-opt compress=true \
  --label rsvp.validation=01a18e04 \
  --volumes-from "$TOOL_ID":ro --workdir /app \
  "$BROWSER_DIGEST" node -e '
  const {chromium,expect}=require("@playwright/test");
  (async()=>{const browser=await chromium.launch();try {
    const page=await browser.newPage();await page.setContent("<button>RSVP</button>");
    const button=page.getByRole("button",{name:"RSVP"});await expect(button).toBeVisible();
    await button.click();if(!(await page.screenshot()).length)throw Error("Empty screenshot");
  }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});')
docker start "$BROWSER_ID" >/dev/null
test "$(docker wait "$BROWSER_ID")" = 0
# Remove all external networking before creating databases or executing app/tests.
docker network disconnect "$NET_ID" "$TOOL_ID"
test "$(docker inspect "$TOOL_ID" --format '{{len .NetworkSettings.Networks}}')" = 0
docker exec "$TOOL_ID" node -e '
 const interfaces=Object.values(require("os").networkInterfaces()).flat();
 if(interfaces.some(i=>i&&!i.internal))throw Error("Non-loopback network interface remains");'
# Prepare only this run's empty PostgreSQL bind directory. No host-wide permissions.
test "$(realpath -- "$SCRATCH/postgres")" = "$SCRATCH/postgres"
test -z "$(ls -A -- "$SCRATCH/postgres")"
PG_SETUP_ID=$(docker create --label rsvp.validation=01a18e04 \
  --network none --user 0:0 --entrypoint /bin/sh \
  --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 --log-opt compress=true \
  --mount "type=bind,src=$SCRATCH/postgres,dst=/pgroot" \
  "$PG_IMAGE" -ec '
    test -z "$(ls -A /pgroot)"
    uid=$(id -u postgres)
    gid=$(id -g postgres)
    test "$uid" -ne 0
    printf "Preparing new validation PGDATA for postgres UID=%s GID=%s\n" "$uid" "$gid"
    chown "$uid:$gid" /pgroot
    chmod 0700 /pgroot
    gosu postgres mkdir -p /pgroot/18/docker
    gosu postgres chmod 0700 /pgroot/18 /pgroot/18/docker
    gosu postgres test -w /pgroot/18/docker
    test "$(stat -c %u:%g /pgroot/18/docker)" = "$uid:$gid"
  ')
docker start "$PG_SETUP_ID" >/dev/null
test "$(docker wait "$PG_SETUP_ID")" = 0
# Share only the isolated container network namespace; publish no host ports.
PG_ID=$(docker create --user postgres:postgres --label rsvp.validation=01a18e04 \
  --network "container:$TOOL_ID" --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 --log-opt compress=true \
  --mount "type=bind,src=$SCRATCH/postgres,dst=/var/lib/postgresql" \
  -e PGDATA=/var/lib/postgresql/18/docker \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=rsvp_test \
  "$PG_IMAGE" postgres -p 55432 -c listen_addresses=127.0.0.1)
REDIS_ID=$(docker create --label rsvp.validation=01a18e04 \
  --network "container:$TOOL_ID" --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 --log-opt compress=true \
  --mount "type=bind,src=$SCRATCH/redis,dst=/data" \
  "$REDIS_IMAGE" redis-server --port 56399 --bind 127.0.0.1)
docker start "$PG_ID" "$REDIS_ID" >/dev/null
ready=0
for attempt in $(seq 1 30); do
  if docker exec "$PG_ID" pg_isready -h 127.0.0.1 -p 55432 -U postgres >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
test "$ready" = 1
docker exec "$REDIS_ID" redis-cli -h 127.0.0.1 -p 56399 ping
# All remaining app/worker/test processes have no external network or daemon socket.
docker exec \
  -e DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/rsvp_test \
  -e REDIS_URL=redis://127.0.0.1:56399 \
  -e SESSION_SECRET=isolated-preflight-secret-01a18e04-must-be-long \
  -e NEXT_PUBLIC_APP_URL=http://localhost:3000 -e EMAIL_FROM=ci@example.com \
  -e HOST_INVITE_CODE=ci-test -e OPEN_REGISTRATION=true \
  -e CONTACT_CHANGE_DISPOSABLE_DB=01a18e04 \
  "$TOOL_ID" bash -euo pipefail -c '
  (cd worker && npx --no-install wrangler deploy --dry-run --outdir /validation-output/worker)
  npx --no-install tsc --ignoreConfig --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM worker/worker.ts
  while IFS= read -r -d "" file; do
    if [ -e "$file" ]; then printf "%s\0" "$file"; fi
  done < <(git ls-files -co --exclude-standard -z) | xargs -0 -r npx --no-install prettier --check --ignore-unknown
  npm run lint
  npm run db:generate
  # First prove migrations against the fresh disposable database, before db push in test setup.
  npx --no-install prisma migrate deploy
  npx --no-install vitest run --config vitest.contact-change.config.ts
  npm run test:coverage
  echo "OFFLINE integration: excludes captcha-siteverify.test.ts (separate external gate)"
  npm run test:integration -- --exclude tests/integration/captcha-siteverify.test.ts
  npm run test:components
  export PORT=3001 NEXT_PUBLIC_APP_URL=http://localhost:3001
  npm run build
  npx --no-install tsc --noEmit
  SEED_TEST_DATA=true npm run db:seed
  . scripts/lib/preflight-process-group.sh
  preflight_assert_port_available 3001
  # The host destroys this exact container and all its processes on every exit.
  npm exec -- next start --hostname 127.0.0.1 >/validation-output/server.log 2>&1 &
  npx --no-install wait-on http://127.0.0.1:3001/api/health --timeout 120000
  PLAYWRIGHT_BASE_URL=http://localhost:3001 npm run test:e2e -- --output /validation-output/playwright
'
echo 'ALL SPLIT PREFLIGHT GATES PASSED (including external Siteverify 3/3; all application/DB tests isolated)'
