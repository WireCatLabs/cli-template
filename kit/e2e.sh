#!/usr/bin/env bash
# Installs the packed template the way npx does, never by unpacking the tarball: npm renames files on install
# that a tar unpack keeps. Then builds a CLI made from it, once with a name shorter than the template's and once
# with a longer one, since a rename changes line lengths and Biome's formatting with them. Needs the network; takes
# a few minutes.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d "${TMPDIR:-/tmp}/kit-e2e-XXXXXX")
trap 'rm -rf "$work"' EXIT

cd "$root"
pnpm build >/dev/null
tarball=$(npm pack --silent --ignore-scripts --pack-destination "$work" | tail -n 1)
npm install --silent --no-save --prefix "$work/install" "$work/$tarball"

# build <name> <command>
build() {
  mkdir "$work/new-$2"
  cd "$work/new-$2"
  "$work/install/node_modules/.bin/cli-template" new "$1" --command "$2" --package "@example/$1" \
    --owner example --category notes --content-lang en --sign-in none --api official-docs --filters time \
    --never-store tokens --untrusted none >/dev/null
  cmp "$root/.gitignore" "$1/.gitignore"
  cd "$1"
  pnpm install
  # As new's next steps say: the rename changes line lengths, so Biome formats the renamed files once.
  pnpm lint:fix
  pnpm lint
  pnpm ci:quick
  pnpm test:coverage
  echo "kit e2e: new $1 ($2) passed lint, ci:quick and test:coverage"
}

build demo-cli demo
build acme-workspace-cli acme-workspace

cd "$work/new-demo/demo-cli"
bin=$(node -p 'require("./package.json").bin.demo')
node "$bin" --version
# A run record must not land in the real home folder, and no run may reach the owner's keyring.
demo() { env -u XDG_CONFIG_HOME -u XDG_DATA_HOME -u XDG_STATE_HOME -u XDG_CACHE_HOME HOME="$work/home" DBUS_SESSION_BUS_ADDRESS=disabled: node "$bin" "$@"; }
demo personal skill show "weekly report" >/dev/null 2>&1 || true
kept=$(demo personal runs list --json | grep -o '"argv":\[[^]]*"weekly report"[^]]*\]')
demo personal skill show "+1 202 555 0123" >/dev/null 2>&1 || true
phone=$(demo personal runs list --json | grep -o '"argv":\["personal","skill","show","\[redacted\]"\]')
# Built at run time so the source holds no token; under 40 characters, so only detection by content hides it.
demo personal skill show "token sk-$(printf 'x%.0s' {1..24})" >/dev/null 2>&1 || true
token=$(demo personal runs list --json | grep -o '"argv":\["personal","skill","show","token \[redacted\]"\]')
demo personal skill show "password tulip42" >/dev/null 2>&1 || true
named=$(demo personal runs list --json | grep -o '"argv":\["personal","skill","show","password \[redacted\]"\]')
# The sample: a preview names the write's key and sends nothing; without a sign-in a read stops before any request.
preview=$(demo personal comments create --text "kit e2e" --dry-run --json | grep -o '"key":"comments.create"')
unsigned=$(demo personal comments list --json 2>&1 >/dev/null | grep -o '"code":"authentication_error"' || true)
[ -n "$unsigned" ]
echo "kit e2e: $tarball installed with npm, and the CLIs made from it run as demo and acme-workspace"
echo "kit e2e: a failed run keeps what was typed: $kept"
echo "kit e2e: a typed phone number is hidden: $phone"
echo "kit e2e: a typed token is hidden: $token"
echo "kit e2e: a password typed after its name is hidden: $named"
echo "kit e2e: the sample's --dry-run names $preview, and without a sign-in it says $unsigned"
