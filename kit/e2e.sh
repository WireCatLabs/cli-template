#!/usr/bin/env bash
# Installs the packed template the way npx does, never by unpacking the tarball: npm renames files on install
# that a tar unpack keeps. Then builds a CLI made from it. Needs the network; takes a few minutes.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d "${TMPDIR:-/tmp}/kit-e2e-XXXXXX")
trap 'rm -rf "$work"' EXIT

cd "$root"
pnpm build >/dev/null
tarball=$(npm pack --silent --ignore-scripts --pack-destination "$work" | tail -n 1)
npm install --silent --no-save --prefix "$work/install" "$work/$tarball"

mkdir "$work/new"
cd "$work/new"
"$work/install/node_modules/.bin/cli-template" new demo-cli --command demo --package @example/demo-cli \
  --owner example --category notes --content-lang en --sign-in none --api official-docs --filters time \
  --never-store tokens --untrusted none >/dev/null
cmp "$root/.gitignore" demo-cli/.gitignore

cd demo-cli
pnpm install
pnpm ci:quick
pnpm test:coverage
bin=$(node -p 'require("./package.json").bin.demo')
node "$bin" --version
# A run record must not land in the real home folder.
demo() { env -u XDG_CONFIG_HOME -u XDG_DATA_HOME -u XDG_STATE_HOME -u XDG_CACHE_HOME HOME="$work/home" node "$bin" "$@"; }
demo personal skill show "weekly report" >/dev/null 2>&1 || true
kept=$(demo personal runs list --json | grep -o '"argv":\[[^]]*"weekly report"[^]]*\]')
demo personal skill show "+1 202 555 0123" >/dev/null 2>&1 || true
phone=$(demo personal runs list --json | grep -o '"argv":\["personal","skill","show","\[redacted\]"\]')
echo "kit e2e: $tarball installed with npm, new demo-cli built, passed ci:quick and test:coverage, and runs as demo"
echo "kit e2e: a failed run keeps what was typed: $kept"
echo "kit e2e: a typed phone number is hidden: $phone"
