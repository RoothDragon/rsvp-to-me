---
title: Verified RSVP Release Validation
description: Validate reviewed sources using disposable local Docker services.
category: Administration
audience: admin
order: 90
---

# Verified RSVP release validation

These commands are prepared for EC2 only; none have been executed remotely. Do not run the old procedure. Use the reproducible `rsvp-01a18e04-source.tar.gz` archive and its `SHA256SUMS` sidecar, transferred only after user approval. The archive contains the complete base source plus every reviewed modification and new file; it does not depend on modifications in the EC2 checkout. Verify the archive hash against the value supplied by this Windows review.

## Isolated checkout and clean environment

Run the blocks in order, in one dedicated shell. The approved base is pinned below; stop on any mismatch rather than silently selecting a newer revision. No Compose command is used. The existing `rsvp-verify-dev` project, `compose.verify.local.yml`, and `.env.verify.local` are never loaded.

```bash
SAFE_HOME=$(mktemp -d /tmp/rsvp-validation-home.XXXXXXXX)
NVM_INSTALL="$HOME/.nvm"
env -i HOME="$SAFE_HOME" NVM_DIR="$NVM_INSTALL" PATH=/usr/local/bin:/usr/bin:/bin \
  DOCKER_HOST=unix:///var/run/docker.sock \
  /bin/bash --noprofile --norc
```

The preceding command opens a clean child shell. Continue inside it. Docker must be reachable through the local Unix socket; do not substitute a remote Docker context. The clean HOME avoids existing npm, Git, Wrangler, cloud, and Docker credential files; the environment allow-list excludes database URLs, Compose variables, NODE_OPTIONS, BASH_ENV, cloud tokens, and delivery credentials. The sole existing shell code sourced below is the trusted nvm installation.

```bash
set -euo pipefail
umask 077
BASE=9a3ffb735f2311a1b897fc8ed40d4bda76016245
HANDOFF=/tmp/rsvp-01a18e04-handoff
cd "$HANDOFF"
# Compare this checksum with the Windows handoff before trusting the sidecar.
cat SHA256SUMS
sha256sum -c SHA256SUMS
RUN=$(mktemp -d /tmp/rsvp-01a18e04-validation.XXXXXXXX)
# The locally verified archive contains regular relative paths only, with no duplicates.
tar --extract --gzip --file rsvp-01a18e04-source.tar.gz --directory "$RUN" --no-same-owner
cd "$RUN"
sha256sum -c SOURCE-FILES.sha256
sha256sum -c REVIEWED-FILES.sha256
grep -Fx "base=$BASE" VALIDATION-SNAPSHOT.txt
grep -Fx "branch=feature/verified-guest-rsvp" VALIDATION-SNAPSHOT.txt
# Only initialize local Git metadata required by preflight; create no commit.
git init -q .
# Refuse source symlinks that could redirect writes outside the temporary checkout.
test -z "$(find . -path ./.git -prune -o -type l -print)"

# Refuse dotenv files anywhere in the snapshot, including worker/.
# Only .env.example templates are allowed; these are not loaded by dotenv or Next.js.
test -z "$(find . -path ./.git -prune -o -name '.env*' ! -name '.env.example' -print)"
test -f "$NVM_DIR/nvm.sh"
. "$NVM_DIR/nvm.sh"
nvm use
export TMPDIR=/tmp TMP=/tmp TEMP=/tmp
docker info >/dev/null
npm ci
```

## Real PostgreSQL integration

```bash
(
  set -euo pipefail
  PG_ID=""
  cleanup() { [ -z "$PG_ID" ] || docker rm -fv "$PG_ID" >/dev/null; }
  trap cleanup EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  PG_ID=$(docker create --label rsvp.validation=01a18e04 \
    -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=rsvp_test \
    -p 127.0.0.1:55432:5432 postgres:18-alpine)
  docker start "$PG_ID" >/dev/null
  ready=0
  for attempt in $(seq 1 30); do
    if docker exec "$PG_ID" pg_isready -U postgres >/dev/null 2>&1; then ready=1; break; fi
    sleep 1
  done
  test "$ready" = 1
  export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/rsvp_test
  export CONTACT_CHANGE_DISPOSABLE_DB=01a18e04
  export SESSION_SECRET=isolated-contact-change-test-secret-01a18e04
  export NEXT_PUBLIC_APP_URL=http://localhost:3000
  npx vitest run --config vitest.contact-change.config.ts
)
```

Expected: seven PostgreSQL tests pass. These force real account/RSVP constraint failures and retry after rollback, race two unused-token reads, and reject missing/expired/wrong-type/used tokens. Only external session-cookie, Redis, and linking effects are mocked. The dedicated setup validates the URL and marker before schema writes.

## Full canonical preflight

Run only after the integration subshell exits and removes its PostgreSQL container.

```bash
set -o pipefail
bash scripts/preflight.sh 2>&1 | tee "$RUN/preflight.log"
```

The corrected script captures new container IDs, never deletes fixed container names, and removes only those IDs plus their anonymous volumes. Both services bind 127.0.0.1. If a port is occupied, startup fails before migrations; no connection is made to the occupant. The E2E app binds 127.0.0.1:3001. Its process group alone is stopped. No existing Compose network or volume is attached. Worker bundle, browser artifacts, and server logs use a unique output directory.

Keep the extracted source snapshot, clean HOME, and logs for inspection; there is no recursive directory cleanup command. Do not run `scripts/run-e2e-docker.sh`, `dev-reset.sh`, Compose down, or migrations against an existing environment. The helper `check-playwright-docker.sh` uses a read-only checkout mount, no network, and a new `--rm` browser container. `wrangler deploy --dry-run` bundles locally only. Dependency downloads/audits are expected network operations.

No shell procedure can promise recovery after SIGKILL/host failure; a container created immediately before such an interruption can remain orphaned. Inspect its ID and validation label before any manual cleanup. Ports are loopback-only; host administrators and other host processes remain trusted.

## Authorization findings and release checklist

- New protected RSVPs require EMAIL login provenance matching both account and submitted email; legacy/SMS sessions and secondary phone submissions are rejected.
- Protected edits require the edit token and a live session for the linked RSVP owner. Edit authorization uses ownership, not a new email-verification ceremony on every edit.
- Session ids and user ids from the backing database/cache must match the sealed cookie.
- Host/co-host/admin settings may explicitly disable verification. This immediately restores edit-token authority for existing responses. If persistent per-response protection is required, that is a separate policy and storage change.
- Contact-change database writes are atomic; post-commit RSVP linking/session/cache/cookie failures do not roll back a successful contact change. Users may need to sign in again after such a failure.
- Pass the real PostgreSQL suite, the full preflight, and a browser smoke test covering email verification, RSVP creation/editing, and toggling the event setting.
- Review the final diff, dependency/lockfile stability, production-isolation evidence, and commit boundaries before requesting shipping approval.
