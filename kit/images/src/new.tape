# One command to a CLI that answers. Rendered by kit/images/render.ts into kit/images/new.gif.
# Everything runs in a fresh temporary folder that is also HOME, out of reach of the keyring, with no sign-in.

Output kit/images/new.gif

Set Shell "bash"
Set FontSize 20
Set Width 1200
Set Height 640
Set Padding 24
Set Theme "TokyoNight"
Set TypingSpeed 25ms
Set WindowBar Colorful

Hide
Type `export npm_config_cache="$(npm config get cache)" pnpm_config_store_dir="$(cd ~ && pnpm store path)" COREPACK_HOME="${COREPACK_HOME:-$HOME/.cache/node/corepack}"` Enter
Type `cd "$(mktemp -d /tmp/acme.XXXX)" && export HOME="$PWD" XDG_CONFIG_HOME="$PWD/.config" XDG_DATA_HOME="$PWD/.local/share" XDG_STATE_HOME="$PWD/.local/state" XDG_CACHE_HOME="$PWD/.cache" DBUS_SESSION_BUS_ADDRESS="disabled:" PS1='$ '` Enter
Type "clear" Enter
Show

Type "npx @wirecat/cli-template@0.25.0 new acme-cli --command acme --package @example/acme-cli --owner example \" Enter
Type "  --category crm --content-lang en --sign-in token --api official-docs --spec openapi --filters time,person \" Enter
Type "  --never-store tokens --untrusted names,links | head -4" Enter
Wait@60s /\$$/
Sleep 2s

Type "cd acme-cli && pnpm install --silent && pnpm generate >/dev/null 2>&1" Enter
Hide
Wait@120s /\$$/
Type "clear" Enter
Show

Type "node dist/bin/acme.js personal api list" Enter
Wait@20s /\$$/
Sleep 3s

Type "node dist/bin/acme.js doctor" Enter
Wait@20s /\$$/
Sleep 4s
