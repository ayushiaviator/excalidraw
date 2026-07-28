#!/bin/bash
# Preview environment setup for excalidraw (Aviator Verify).
#
# Aviator runs this inside a freshly-booted preview sandbox, AFTER it has
# fetched the repo into /code and checked out the runbook's branch. Our job is
# to make sure dependencies match the branch and get the dev server listening.
#
# Contract:
#   * PREVIEW_URL is injected with the sandbox's public https URL.
#   * The script MUST start the app and then EXIT. If it blocks, the launch
#     times out (PREVIEW_SCRIPT_TIMEOUT_SEC, default 1800s).
#   * A non-zero exit fails the preview and shows the tail of our output, so
#     anything worth debugging has to be printed here.
set -euo pipefail

LOG="/tmp/preview-timing.log"
START=$(date +%s)

t() {
  local now
  now=$(date +%s)
  echo "[$((now - START))s] $1" | tee -a "$LOG"
}

t "Starting excalidraw preview setup"

# The sandbox runs as root while the image cloned /code as a different uid, so
# git refuses to touch it until it is marked safe. The Dockerfile already sets
# this system-wide; repeated here because it is cheap and this script must work
# even if the image is rebuilt without it.
git config --global --add safe.directory /code
cd /code

# Everything the app needs is under /code/node_modules/.bin, which is NEVER on
# PATH. e2b also runs with a fixed PATH of
#   /usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# so `vite` by bare name is `command not found`. Use the absolute path.
# (node/npm/yarn themselves live in /usr/local/bin, which IS on that list.)
VITE="/code/node_modules/.bin/vite"
APP_DIR="/code/excalidraw-app"
APP_LOG="/var/log/app/vite.log"
PORT=3000

# The Dockerfile sets ENV BROWSER=none, but do NOT rely on that: e2b does not
# carry a base image's environment into the sandbox at run time. (We learned
# this the hard way on another repo, where an image-provided RUSTUP_HOME went
# missing at run time and the build silently fell back to stale code.) Vite's
# config sets `server: { open: true }`, so without this it tries to spawn a
# browser via xdg-open on a machine that has none.
export BROWSER=none

# vite-plugin-checker runs BOTH tsc and eslint inside the dev server, and
# .env.development turns eslint on. Linting the whole repo on every preview
# boot is slow, and on an AI-written branch it is usually noisy besides. A
# verification run cares about runtime behaviour, not lint. Type checking is
# left ON — its overlay is only collapsed, not disabled, so a type error shows
# as a badge rather than a full-screen mask over the app.
export VITE_APP_ENABLE_ESLINT=false

# --- Dependencies ------------------------------------------------------------
#
# The image baked node_modules into /code (~871 MB, ~1900 packages). The launch
# cleans the tree with `git reset --hard` + `git clean -fd` — note no -x — so
# gitignored paths survive, which is why node_modules is still here.
#
# Unlike cargo, yarn has no cheap no-op: `yarn install` against a warm tree
# still walks the whole dependency graph and takes tens of seconds. So gate it
# on whether the branch actually touched the manifests, using the commit the
# image was built from. That marker lives OUTSIDE /code precisely so the launch
# clean cannot delete it.
BASE_SHA=""
[ -f /preview-image-sha ] && BASE_SHA=$(cat /preview-image-sha)

NEED_INSTALL=0
if [ ! -d node_modules ]; then
  t "  node_modules missing — installing"
  NEED_INSTALL=1
elif [ -n "$BASE_SHA" ] && git cat-file -e "$BASE_SHA" 2>/dev/null; then
  t "  build cache baked at $(echo "$BASE_SHA" | cut -c1-12), branch head is $(git rev-parse --short HEAD)"
  # Any workspace's package.json counts, not just the root: this is a yarn
  # workspaces monorepo, so a dependency added under packages/* or
  # excalidraw-app/ changes what needs installing just as much as the root does.
  if git diff --name-only "$BASE_SHA" HEAD | grep -qE '(^|/)(package\.json|yarn\.lock)$'; then
    t "  branch changed package.json/yarn.lock — reinstalling"
    NEED_INSTALL=1
  else
    t "  manifests unchanged — reusing baked node_modules"
  fi
else
  # No usable reference point, so we cannot prove the baked tree matches.
  t "  no usable baked SHA — installing to be safe"
  NEED_INSTALL=1
fi

if [ "$NEED_INSTALL" -eq 1 ]; then
  t "yarn install..."
  # NOT --frozen-lockfile here. The image build uses it deliberately, to fail
  # loudly if the committed lockfile has drifted. At preview time the opposite
  # is wanted: a runbook branch that adds a dependency legitimately updates
  # both files, and refusing to install would fail the preview for a change
  # that is perfectly valid.
  if yarn install --network-timeout 600000 2>&1 | tail -15; then
    t "  install ok"
  else
    t "ERROR: yarn install failed — cannot start a dev server for this branch"
    exit 1
  fi
fi

# --- Seed data ---------------------------------------------------------------
#
# A preview that opens on a blank canvas is hard to verify against and hard to
# demo, so ship one with a diagram already on it.
#
# The awkward part: excalidraw has no server and no accounts. Scenes live in the
# *browser* (localStorage["excalidraw"]), so there is nothing this script can
# write from inside the sandbox — the seeding has to happen in whichever browser
# opens the preview URL. So instead of writing data, we arrange for the app to
# seed itself on first load: drop a classic script into vite's publicDir and
# point index.html at it.
#
# Both edits are made to the working tree, not committed. The next launch runs
# `git reset --hard` + `git clean -fd` before this script, which reverts
# index.html and deletes the copied asset, and then we redo them here. That is
# why excalidraw's own source carries no trace of this — and why a plain
# `yarn start` outside a preview is completely unaffected.
SEED_SRC="/code/.aviator/preview/seed-scene.js"
SEED_NAME="aviator-preview-seed.js"
# publicDir is "../public" relative to the vite root (excalidraw-app), so this
# resolves to /code/public and is served from the web root as /<SEED_NAME>.
SEED_DEST="/code/public/$SEED_NAME"
INDEX_HTML="$APP_DIR/index.html"

if [ -f "$SEED_SRC" ]; then
  cp "$SEED_SRC" "$SEED_DEST"

  # Injected as a CLASSIC script (no type="module"). Module scripts are
  # deferred, so a module here would run AFTER the app has already read
  # localStorage and found it empty — the seed would land one load too late.
  # Placed just before </head> so it still precedes the app's entry point.
  if grep -q "$SEED_NAME" "$INDEX_HTML"; then
    t "  seed script already injected — leaving index.html alone"
  else
    sed -i "s#</head>#    <script src=\"/$SEED_NAME\"></script>\n  </head>#" "$INDEX_HTML"
    if grep -q "$SEED_NAME" "$INDEX_HTML"; then
      t "  seed data wired in (canvas opens pre-populated)"
    else
      # Not fatal. An unseeded preview is still a working preview, and failing
      # the whole launch over demo data would be a poor trade — but say so
      # loudly, because the alternative is silently wondering where the shapes
      # went.
      t "  WARN: could not inject seed script — index.html has no </head>?"
    fi
  fi
else
  t "  WARN: $SEED_SRC missing — preview will open on an empty canvas"
fi

# --- Start the dev server ----------------------------------------------------
#
# Defensive: normally nothing is running here. Aviator either reconnects to an
# unchanged preview and skips this script entirely, or cold boots a fresh
# sandbox. Kept so that re-running this script by hand does not collide with an
# already-bound port.
if pgrep -f "$VITE" >/dev/null 2>&1; then
  t "Stopping previous vite instance..."
  pkill -f "$VITE" || true
  for _ in $(seq 1 10); do
    pgrep -f "$VITE" >/dev/null 2>&1 || break
    sleep 1
  done
  pkill -9 -f "$VITE" 2>/dev/null || true
fi

t "Starting vite on 0.0.0.0:${PORT}..."
mkdir -p /var/log/app
cd "$APP_DIR"

# Flags, and why each one matters:
#
#   --host 0.0.0.0  Vite listens on localhost only by default. The browser
#                   driving this preview runs on an Aviator worker, not inside
#                   the sandbox, so a loopback-only server is unreachable — and
#                   it looks perfectly healthy in the logs while failing.
#
#   --port 3000     Pinned rather than inherited. vite.config.mts reads
#                   `VITE_APP_PORT || 3000`, and the repo's checked-in
#                   .env.development sets it to 3001 — so the apparent default
#                   is not the real one. Passing it explicitly means the port in
#                   Aviator's config cannot drift when someone edits a .env file.
#
#   --strictPort    Without it, Vite silently falls forward to the next free
#                   port if 3000 is taken. Aviator only exposes the ONE port
#                   from its config, so a silent shift to 3001 would leave the
#                   public URL pointing at nothing. Fail loudly instead.
#
# setsid + closed stdin + redirect: the server has to outlive this script.
# Without detaching, it dies the moment the setup command returns.
setsid "$VITE" --host 0.0.0.0 --port "$PORT" --strictPort \
  < /dev/null > "$APP_LOG" 2>&1 &
disown

# Do not report success until the port actually answers. Reporting early hands
# the verifier a URL that fails on its first navigation, which reads as a broken
# app rather than a not-yet-started one.
t "Waiting for vite on port ${PORT}..."
for i in $(seq 1 60); do
  if curl -sf -o /dev/null "http://127.0.0.1:${PORT}/"; then
    t "excalidraw is up on port ${PORT} (public URL: ${PREVIEW_URL:-unset})"
    break
  fi
  # Fail fast on a crash-on-boot rather than burning the full minute — but not
  # before the process has had a chance to exist. `setsid "$VITE" &` forks a
  # subshell that execs setsid that execs node; until that chain completes,
  # pgrep matches nothing. Checking immediately is a race that passes on a warm
  # machine and reports a healthy server as dead on a cold sandbox.
  if [ "$i" -ge 5 ] && ! pgrep -f "$VITE" >/dev/null 2>&1; then
    t "ERROR: vite exited during startup — last log lines:"
    tail -40 "$APP_LOG" | tee -a "$LOG" || true
    exit 1
  fi
  if [ "$i" -eq 60 ]; then
    t "ERROR: vite did not come up on port ${PORT} — last log lines:"
    tail -40 "$APP_LOG" | tee -a "$LOG" || true
    exit 1
  fi
  sleep 1
done

# Note the seeding above is browser-side, unlike the microbin preview, which
# seeds over HTTP against a running server. excalidraw has no server to seed
# into, so the data lands in localStorage on first page load instead. The
# practical difference: microbin's seed is shared by everyone who opens the
# preview, while this one is materialised per browser. Same scene either way,
# since it is generated from a file committed to the repo.
t "Preview environment ready."
