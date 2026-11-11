---
title: Verified RSVP Release Validation
description: Validate an immutable committed snapshot with disposable Docker-only infrastructure.
category: Administration
audience: admin
order: 90
---

# Verified RSVP release validation

## Source identity and handoff

The current validation source is the committed Git tree at `34e5d3690d804a345c0c8fddff6125ec3393c1d9` on `wip/verified-guest-rsvp-validation`, tree `5ea69d09961a709f15b1181e007116e3345c16d3`. The archive is generated exclusively from Git objects, with no working-directory overlay. The old reboot-volatile `/tmp` snapshot is not needed.

The handoff contains `rsvp-34e5d36-source.tar.gz`, `docker-validation.sh`, this updated runbook as `verified-rsvp-validation.md`, and `SHA256SUMS`. The archive embeds `VALIDATION-SNAPSHOT.txt`, `COMMITTED-FILES.sha256` for every committed file, and `SOURCE-FILES.sha256` for the committed files plus metadata/manifests (excluding itself). The build normalizes timestamps and ownership and verifies every source blob against its Git object ID. Two builds must be byte-identical.

The archive intentionally retains the script and documentation as committed at `34e5d36`. **Execute only the separately checksummed handoff `docker-validation.sh`**, which understands the new metadata. Do not execute the obsolete script or instructions embedded in the immutable source archive. No application source is changed to create this handoff.

## Transfer after approval

No transfer, Docker operation, or EC2 command is performed by preparing these artifacts. Obtain approval before distributing source. On Windows, use the absolute artifact directory supplied with the handoff and the actual SSH destination. The following commands are examples with required values, not commands that have already run:

```powershell
$artifactDir = '<absolute local handoff directory>'
$ec2 = '<user@EC2-host>'
ssh $ec2 'set -eu; umask 077; test ! -L /apps/validation; test ! -L /apps/validation/rsvp-01a18e04; mkdir -p /apps/validation/rsvp-01a18e04; test ! -L /apps/validation/rsvp-01a18e04; mkdir /apps/validation/rsvp-01a18e04/handoff-34e5d36'
if ($LASTEXITCODE -ne 0) { throw 'Handoff directory preparation failed; stop and inspect.' }
scp "$artifactDir/rsvp-34e5d36-source.tar.gz" "$artifactDir/docker-validation.sh" "$artifactDir/verified-rsvp-validation.md" "$artifactDir/SHA256SUMS" "${ec2}:/apps/validation/rsvp-01a18e04/handoff-34e5d36/"
if ($LASTEXITCODE -ne 0) { throw 'Transfer failed.' }
```

The handoff directory must be new; if it exists, stop and inspect rather than overwrite it. No production/development checkout, Compose project, database, network, or volume is used. Compare the transferred `SHA256SUMS` with the values supplied by the Windows review before trusting it.

## Verify and extract on EC2

Host requirements are Bash, coreutils, GNU tar, util-linux (`findmnt`), and Docker reachable through the local Unix socket. Host Node, npm, and NVM are neither required nor installed. The existing `node:22-bookworm` image supplies Node. Validation accepts stable Node `>=22.23.1 <23` and npm `10.9.x`.

Run these blocks in the same shell:

```bash
set -euo pipefail
umask 077
STORAGE=/apps/validation/rsvp-01a18e04
test "$(findmnt -n -o TARGET -T /apps)" = /apps
test "$(findmnt -n -o FSTYPE -T /apps)" = xfs
for path in /apps/validation "$STORAGE"; do
  test ! -L "$path"
  test -d "$path"
done
test "$(realpath -- "$STORAGE")" = "$STORAGE"
HANDOFF="$STORAGE/handoff-34e5d36"
test ! -L "$HANDOFF"
cd "$HANDOFF"
cat SHA256SUMS
# First compare the displayed hashes against the trusted Windows handoff.
sha256sum -c SHA256SUMS
bash -n "$HANDOFF/docker-validation.sh"
RUN=$(mktemp -d "$STORAGE/snapshot.34e5d36.XXXXXXXX")
tar --extract --gzip --file "$HANDOFF/rsvp-34e5d36-source.tar.gz" \
  --directory "$RUN" --no-same-owner
cd "$RUN"
sha256sum -c SOURCE-FILES.sha256
sha256sum -c COMMITTED-FILES.sha256
grep -Fx 'format=rsvp-committed-source-v2' VALIDATION-SNAPSHOT.txt
grep -Fx 'commit=34e5d3690d804a345c0c8fddff6125ec3393c1d9' VALIDATION-SNAPSHOT.txt
grep -Fx 'tree=5ea69d09961a709f15b1181e007116e3345c16d3' VALIDATION-SNAPSHOT.txt
grep -Fx 'branch=wip/verified-guest-rsvp-validation' VALIDATION-SNAPSHOT.txt
test -z "$(find . -type l -print)"
test -z "$(find . -name '.env*' ! -name '.env.example' -print)"
```

The archive is locally checked to contain only unique regular relative file paths. Do not substitute a checkout of the base commit or copy uncommitted files into this extracted snapshot. The orchestrator rechecks both manifests and the exact commit/tree metadata before creating any resources.

## Execute under a clean environment

```bash
CLEAN_HOME=$(mktemp -d "$STORAGE/host-home.XXXXXXXX")
LOG=$(mktemp "$STORAGE/validation.XXXXXXXX.log")
set -o pipefail
env -i HOME="$CLEAN_HOME" \
  PATH=/usr/local/bin:/usr/bin:/bin \
  DOCKER_HOST=unix:///var/run/docker.sock \
  /bin/bash --noprofile --norc \
  "$HANDOFF/docker-validation.sh" "$RUN" 2>&1 | tee "$LOG"
```

Do not source `.env.verify.local` or any application environment. The clean HOME/environment avoids inherited database URLs, credentials, Docker contexts, cloud configuration, and shell startup files. There is no Docker socket mount in any test container and no host network/PID/IPC sharing. The host orchestrator alone manages the daemon.

## Storage and isolated phases

All substantial writable data lives under a fresh `run.XXXXXXXX` directory inside `/apps/validation/rsvp-01a18e04`: the working source copy, dependencies, npm cache, downloaded browsers, apt caches, build artifacts, test reports, PostgreSQL/Redis data, and logs. The immutable snapshot is mounted read-only. Docker images/container OS layers remain under Docker root. The script requires disk-backed storage with at least 8 GiB free at Docker root and 12 GiB on `/apps`; the reported 11/19 GiB satisfies these admission checks but is not a quota or assurance about peak disk/RAM usage. The 1.9 GB host `/tmp` tmpfs is not used for substantial artifacts.

1. A newly created download network permits dependency installation, audits, and browser downloads. No real database URL, credential files, or application service mounts are supplied. Node/npm runtime versions are checked numerically before installation.
2. An unprivileged external Siteverify runner executes only the three unchanged Cloudflare tests using documented dummy credentials. Its standalone config has no database setup; native config loading avoids `.vite-temp` writes. Read-only source/dependency mounts and a dedicated writable runtime directory are enforced. The fetch guard restricts requests to the Siteverify endpoint, dummy token/keys, and disallows redirects. Exactly three passes are required; failures stop validation and are retained in logs. This is workload-level scoping, not a network firewall against malicious dependency code.
3. A network-disabled Playwright-image smoke test uses read-only validation mounts.
4. The application runner disconnects from its download network. Both Docker endpoint inspection and the Node interface check must confirm loopback-only networking before databases start.
5. A network-disabled helper prepares only the fresh PostgreSQL bind directory using the image's actual postgres UID/GID and mode 0700. PostgreSQL runs as `postgres:postgres`, with explicit `PGDATA=/var/lib/postgresql/18/docker`. Redis and PostgreSQL share only the isolated runner's network namespace, listening on loopback ports 56399/55432. No host ports are published and no existing networks/volumes are attached.
6. Offline gates cover worker dry-run/type-check, formatting/lint, Prisma generation, fresh-database migrations, seven dedicated contact-change cases, unit coverage, PostgreSQL integration excluding the separately gated Siteverify suite, components, production build, TypeScript, seed, and browser E2E. The temporary app binds loopback port 3001.

This orchestrates the preflight gates in Docker; it does not claim that the host-only `scripts/preflight.sh` was executed literally. Do not run that script, the legacy Docker E2E helper, `dev-reset.sh`, or any Compose down/reset command on the shared host as a substitute.

## Cleanup and release evidence

EXIT/INT/TERM cleanup removes only captured container IDs (including preparation/external runners) and the newly created download-network ID. Logging uses `json-file`, `max-size=10m`, `max-file=3`, and compression. No fixed-name deletion, pruning, broad chmod/chown, or host directory removal occurs. Per-run host data/logs and the immutable snapshot are retained for inspection. SIGKILL or host failure can leave orphaned resources; inspect IDs/labels before any manual cleanup.

Collect the transcript, per-phase reports and container image IDs before reporting release readiness. A successful static check is not an EC2 validation pass. Every blocking gate must pass, or receive a separate explicit user waiver. No push, merge, deployment, production migration, or production/dev service modification is authorized by validation.
