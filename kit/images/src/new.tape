# From a public API description to a CLI that answers and an MCP server that starts. Rendered by kit/images/render.ts
# into kit/images/new.gif. Everything runs in a fresh temporary folder that is also HOME, out of reach of the keyring,
# with no sign-in: PokeAPI needs none. With KIT_BIN set (render.ts --local), npx runs this checkout's kit.

Output kit/images/new.gif

Set Shell "bash"
Set FontSize 20
Set Width 1280
Set Height 700
Set Padding 24
Set Theme "TokyoNight"
Set TypingSpeed 20ms
Set WindowBar Colorful

Hide
Type `export npm_config_cache="$(npm config get cache)" pnpm_config_store_dir="$(cd ~ && pnpm store path)" COREPACK_HOME="${COREPACK_HOME:-$HOME/.cache/node/corepack}"` Enter
Type `[ -z "$KIT_BIN" ] || npx() { if [ "$1" = @wirecat/cli-template ]; then shift; node "$KIT_BIN" "$@"; else command npx "$@"; fi; }` Enter
Type `cd "$(mktemp -d /tmp/acme.XXXX)" && export HOME="$PWD" XDG_CONFIG_HOME="$PWD/.config" XDG_DATA_HOME="$PWD/.local/share" XDG_STATE_HOME="$PWD/.local/state" XDG_CACHE_HOME="$PWD/.cache" DBUS_SESSION_BUS_ADDRESS="disabled:" PS1='$ '` Enter
Type "clear" Enter
Show

Type "npx @wirecat/cli-template new poke-cli --preset generic --owner example --sign-in none \" Enter
Type "  --spec-url https://raw.githubusercontent.com/PokeAPI/pokeapi/d19c710/openapi.yml | head -2" Enter
Wait@60s /\$$/
Sleep 2s

Type "cd poke-cli && time (pnpm install --silent && pnpm generate >/dev/null 2>&1)" Enter
Wait@120s /\$$/
Sleep 1s
Type `node dist/bin/poke.js api list --json 2>/dev/null | grep -o '"command"' | wc -l` Enter
Wait@20s /\$$/
Sleep 2s

Type "node dist/bin/poke.js personal api pokemon-get --id pikachu --json=name,height,weight" Enter
Wait@20s /\$$/
Sleep 3s

Type "node dist/bin/poke.js personal mcp check" Enter
Wait@20s /\$$/
Sleep 4s

Hide
Type `cd /tmp && rm -rf "$HOME"` Enter
