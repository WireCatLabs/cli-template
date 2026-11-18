# From Notion's own OpenAPI description to a CLI with one command per operation, an MCP server and an agent skill.
# Rendered by kit/images/render.ts into kit/images/new.gif. Everything runs in a fresh temporary folder that is also
# HOME, out of reach of the keyring, with no sign-in. With KIT_BIN set (render.ts --local), npx runs this checkout's kit.
# Only the waiting for pnpm install and pnpm generate is cut; `time` prints how long it took.

Output kit/images/new.gif

Set Shell "bash"
Set FontSize 15
Set Width 1280
Set Height 720
Set Padding 24
Set Theme "TokyoNight"
Set TypingSpeed 15ms
Set WindowBar Colorful

Hide
Type `export npm_config_yes=true npm_config_cache="$(npm config get cache)" pnpm_config_store_dir="$(cd ~ && pnpm store path)" COREPACK_HOME="${COREPACK_HOME:-$HOME/.cache/node/corepack}"` Enter
Type `[ -z "$KIT_BIN" ] || npx() { if [ "$1" = @wirecat/cli-template ]; then shift; node "$KIT_BIN" "$@"; else command npx "$@"; fi; }` Enter
Type `cd "$(mktemp -d /tmp/acme.XXXX)" && export HOME="$PWD" XDG_CONFIG_HOME="$PWD/.config" XDG_DATA_HOME="$PWD/.local/share" XDG_STATE_HOME="$PWD/.local/state" XDG_CACHE_HOME="$PWD/.cache" DBUS_SESSION_BUS_ADDRESS="disabled:" PS1='$ ' TIMEFORMAT='done in %0Rs'` Enter
Type "clear" Enter
Show

Type "npx @wirecat/cli-template new notion-cli --preset generic --owner acme --sign-in token \" Enter
Type "  --spec-url https://raw.githubusercontent.com/makenotion/notion-mcp-server/cf16e5c/scripts/notion-openapi.json" Enter
Wait+Screen@90s /fails until step 1 is done/
Sleep 6s

Type "clear" Enter
Type "cd notion-cli && time (pnpm install --silent && pnpm generate > /dev/null 2>&1)" Enter
Hide
Wait+Screen@180s /done in/
Show
Sleep 1s

Type "ls spec/notion src/generated skills/acme-notion-cli/references/api" Enter
Wait+Screen@10s /api-pages.md/
Sleep 5s

Type "clear" Enter
Type "node dist/bin/notion.js api list tag:Pages" Enter
Sleep 6s

Type "clear" Enter
Type "node dist/bin/notion.js personal api pages-markdown-list --help" Enter
Sleep 7s

Hide
Type `cd /tmp && rm -rf "$HOME"` Enter
