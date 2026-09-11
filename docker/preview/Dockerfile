# ---------------------------------------------------------------------------
# Aviator Verify — preview-environment image for excalidraw
# ---------------------------------------------------------------------------
#
# WHAT THIS IMAGE IS
#
# This is NOT a container that runs the app. It is a PRE-WARMED MACHINE.
# Aviator boots an e2b microVM from this image, and a separate setup script
# (not part of this file) starts the dev server inside it. A headless browser
# running on Aviator's own servers then drives the app over the public
# internet to check that AI-written code actually works.
#
# Because of that, this file deliberately has:
#   * no CMD / no ENTRYPOINT  — Aviator never invokes them
#   * no COPY / no ADD        — this Dockerfile is pasted into Aviator's UI,
#                               which has no build context and whose parser
#                               rejects those instructions outright
#                               (ForbiddenCommandInDockerfileError)
#   * no browser (Chrome / Playwright) — the browser lives on Aviator's side
#
# HOW THE CACHING ACTUALLY WORKS (the key idea)
#
# At preview launch Aviator:
#   1. boots a sandbox from this image
#   2. sees that /code is already a git repo pointing at the connected
#      remote, and takes the "git fetch fast path" instead of a full clone
#   3. cleans the tree with:  git reset --hard  &&  git clean -fd
#   4. runs the setup script, which starts the app
#
# Step 3 is the whole trick. `git clean -fd` has NO `-x` flag, so it removes
# untracked files but *leaves gitignored files alone*. Anything gitignored
# that we bake in here therefore SURVIVES into every single preview run.
# node_modules is gitignored in this repo (verified in .gitignore, and
# assertable with `git -C /code check-ignore -v node_modules`), so baking
# `yarn install` below is what makes previews start in seconds instead of
# spending several minutes installing ~1900 packages every time.
#
# ---------------------------------------------------------------------------

# excalidraw's package.json declares `engines: { node: ">=18.0.0" }` and pins
# `packageManager: "yarn@1.22.22"`. node:22-bookworm ships exactly yarn
# 1.22.22, so classic yarn works out of the box with no corepack dance.
FROM node:22-bookworm

# ---------------------------------------------------------------------------
# e2b's forced PATH
# ---------------------------------------------------------------------------
# e2b's template builder runs every RUN step with a hard-coded PATH:
#
#   /usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
#
# Ordinary env vars (base-image ones, and your own `ENV FOO=bar`) pass through
# fine, but PATH is special-cased — an `ENV PATH=...` here is IGNORED. Tools
# outside those six directories must be called by absolute path or the build
# dies with `exit status 127`.
#
# Probed against this exact base image under that restricted PATH:
#   node     -> /usr/local/bin/node      (v22.23.1)
#   npm      -> /usr/local/bin/npm
#   yarn     -> /usr/local/bin/yarn      (1.22.22)
#   corepack -> /usr/local/bin/corepack
#
# All four live in /usr/local/bin, which IS on the forced PATH, so every
# command below can be invoked by bare name. No absolute paths needed.
# ---------------------------------------------------------------------------

ENV DEBIAN_FRONTEND=noninteractive

# git is non-negotiable: Aviator itself shells out to git inside the sandbox to
# fetch and check out the runbook branch. git-lfs is installed alongside it
# because a repo that uses LFS pointers will silently check out 130-byte stub
# files without it, and the failure looks like "corrupt assets" rather than
# "missing tool". --no-install-recommends + removing the apt lists keeps the
# layer small; ca-certificates is what lets git talk HTTPS to github.com.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        git \
        git-lfs \
    && rm -rf /var/lib/apt/lists/*

# Register the LFS smudge/clean filters system-wide (--skip-repo because there
# is no repo yet at this point). System-wide, not --global, so the filters are
# active no matter which user the sandbox ends up running commands as.
RUN git lfs install --system --skip-repo

# This image is built as root, but the sandbox may run as a different user.
# Without this, every git command in /code would abort with
# "detected dubious ownership in repository at '/code'" and the checkout —
# and therefore the whole preview — would fail before the app ever starts.
RUN git config --system --add safe.directory /code

# ---------------------------------------------------------------------------
# The /code checkout
# ---------------------------------------------------------------------------
# THE CLONE URL MUST MATCH THE REPO CONNECTED TO AVIATOR — here
# ayushiaviator/excalidraw. This is the single easiest thing to get wrong in
# this file, and getting it wrong fails *silently*.
#
# At launch Aviator inspects the origin URL of whatever repo it finds at /code
# and compares it against the connected repo's name, matching on the last two
# path segments (see _remote_matches_repo — i.e. "ayushiaviator/excalidraw").
# On a match it takes the cheap fast path: widen the refspec, fetch, check out
# the runbook branch, and the baked node_modules below is reused.
#
# On a MISMATCH it does not error. It deletes the whole /code directory and
# performs a full fresh clone — taking the baked node_modules down with it and
# forcing a from-scratch install on every single preview run, which makes this
# entire image pointless. Previews still work; they are just permanently slow,
# with nothing in the logs pointing at the cause. A fork URL that merely
# *looks* right (same repo name, different org) is enough to trigger it.
#
# --filter=blob:none makes this a *partial* clone: git downloads the full
# commit and tree graph but skips historical file contents, fetching blobs
# lazily only when a commit is actually checked out. excalidraw has years of
# history, so this cuts the clone down enormously while keeping the thing we
# genuinely need — the complete ref namespace.
#
# Deliberately NOT --depth 1 and NOT --single-branch. Those look like the
# obvious size optimisations and they are a trap here: a shallow single-branch
# clone rewrites remote.origin.fetch to track only the default branch, so when
# Aviator later runs `git fetch origin <runbook-branch>` no `origin/<branch>`
# ref is ever created and the checkout dies with "invalid reference". A full
# (if blobless) clone leaves the refspec as
# `+refs/heads/*:refs/remotes/origin/*`, which is exactly what Aviator's fast
# path widens to and expects.
RUN git clone --filter=blob:none https://github.com/ayushiaviator/excalidraw.git /code

WORKDIR /code

# ---------------------------------------------------------------------------
# Record which commit was baked — OUTSIDE /code, and that placement is the
# whole point. A marker file written inside /code would be untracked, NOT
# gitignored, and so `git clean -fd` would delete it on the very first preview
# launch. At / it is untouchable by anything git does, which lets the setup
# script (or a human debugging a weird preview) answer "how stale is this
# image's node_modules relative to the branch under test?".
# ---------------------------------------------------------------------------
RUN git -C /code rev-parse HEAD > /preview-image-sha

# ---------------------------------------------------------------------------
# Bake node_modules — the actual payload of this image.
# ---------------------------------------------------------------------------
# excalidraw is a yarn *workspaces* monorepo
# (workspaces: ["excalidraw-app", "packages/*", "examples/*"]), so this single
# root install populates the hoisted /code/node_modules plus every per-package
# node_modules. `node_modules` in .gitignore matches at any depth, so all of
# them survive `git clean -fd`.
#
# --frozen-lockfile makes the build fail loudly if yarn.lock and package.json
# have drifted, instead of quietly baking a tree that doesn't match the repo.
# --network-timeout is raised because a cold install of this dependency tree
# occasionally trips yarn 1's stingy default timeout on a slow builder.
#
# `yarn cache clean` runs in the SAME layer, which matters: a separate RUN
# would leave the cache baked into the earlier layer and delete it only in the
# overlay, shrinking nothing. Keeping the cache was considered — it lives
# outside /code, so it would survive and make the setup script's `yarn install`
# cheaper on a branch that adds a dependency — but it was measured and
# rejected: the cache is ~3.0 GB against ~871 MB of node_modules, i.e. roughly
# 3.4x the payload it exists to accelerate. Paying that on every sandbox boot
# to speed up the occasional dependency delta is the wrong trade; an image this
# much smaller boots faster every single time.
RUN yarn install --frozen-lockfile --network-timeout 600000 \
    && yarn cache clean

# ---------------------------------------------------------------------------
# DECISION: bake `yarn install` only — deliberately NOT `yarn build`.
# ---------------------------------------------------------------------------
# A production bundle was considered and rejected, for three reasons:
#
# 1. It would be wasted work. Runbook branches exist specifically to change
#    source code, so a bundle built from the baked commit is stale the instant
#    the branch is checked out.
# 2. It would be actively dangerous. `build/` and `dist/` are gitignored, which
#    means — exactly like node_modules — they would SURVIVE `git clean -fd`.
#    A stale prebuilt bundle sitting in excalidraw-app/build is a live footgun:
#    anything that serves it statically would serve the OLD code while the
#    verification run reports on the new branch.
# 3. It buys nothing for the dev server. excalidraw-app/vite.config.mts aliases
#    every @excalidraw/* import straight at packages/*/src, so Vite compiles
#    the workspace packages from source. There is no "build the packages first"
#    prerequisite for `yarn start`.
#
# node_modules is the part that is expensive, branch-independent, and safe to
# reuse. That is the part worth baking, and only that part.
# ---------------------------------------------------------------------------

# There is no browser in this sandbox, and excalidraw-app/vite.config.mts sets
# `server: { open: true }`. On startup Vite would try to spawn a browser via
# xdg-open and log a failure. BROWSER=none is Vite's documented opt-out
# (openBrowser() bails when process.env.BROWSER is "none") and is simply a true
# statement about this machine, so it is baked in rather than left for the
# setup script to remember.
ENV BROWSER=none

# ---------------------------------------------------------------------------
# NOTES FOR THE SETUP SCRIPT (the part that actually starts the app)
# ---------------------------------------------------------------------------
# These are properties of the app, not of this image, so they are documented
# here rather than baked in — but getting any of them wrong makes the preview
# unreachable, so they are worth stating explicitly.
#
# 1. THE PORT IS 3001, NOT 3000. vite.config.mts reads
#    `Number(envVars.VITE_APP_PORT || 3000)`, which makes 3000 look like the
#    default — but the repo's checked-in .env.development sets
#    VITE_APP_PORT=3001, so an unconfigured dev server binds 3001. Verified by
#    running it. Vite's loadEnv() also folds in any VITE_-prefixed process env
#    and lets it win over the .env files, so exporting VITE_APP_PORT=3000
#    overrides it cleanly (also verified). Either pin the env var or point
#    Aviator at 3001 — just don't assume 3000.
#
# 2. MUST BIND 0.0.0.0. Vite defaults to listening on localhost only, which is
#    unreachable from outside the microVM. The setup script needs `--host
#    0.0.0.0` (or server.host in config), otherwise Aviator's browser gets
#    connection-refused against a dev server that looks perfectly healthy in
#    the logs.
#
# 3. NO HOST ALLOWLIST PROBLEM — TODAY. Aviator reaches the app on a public
#    e2b domain, and Vite's dev server rejects unknown Host headers with
#    "Blocked request. This host is not allowed" as of 5.4.12 / 6.x. This repo
#    pins vite 5.0.12, which predates that check entirely (confirmed: no
#    allowedHosts code in the installed build), so any Host is accepted. If
#    vite is ever bumped, this silently becomes a hard blocker and the setup
#    script will need server.allowedHosts configured.
#
# 4. vite-plugin-checker RUNS tsc AND eslint IN THE DEV SERVER. .env.development
#    sets VITE_APP_ENABLE_ESLINT=true, so every start lints the whole repo,
#    which is slow and — on AI-written branches — usually noisy. Setting
#    VITE_APP_ENABLE_ESLINT=false makes startup meaningfully faster and is
#    almost always what a verification run wants, since it cares about runtime
#    behaviour rather than lint. Note the checker's error overlay is only
#    collapsed (VITE_APP_COLLAPSE_OVERLAY=true), not disabled, so type errors
#    surface as a badge rather than a full-screen mask over the app.
#
# 5. `yarn start` is `yarn && vite` — it reinstalls before booting. That is a
#    near-instant no-op against the baked node_modules, but it does need
#    network. Invoking vite directly avoids the round trip entirely.
# ---------------------------------------------------------------------------
