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
node "$(node -p 'require("./package.json").bin.demo')" --version
echo "kit e2e: $tarball installed with npm, new demo-cli built, passed ci:quick and runs as demo"
