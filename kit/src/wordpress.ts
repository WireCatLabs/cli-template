import type { LoadedConfig } from "./from-config.js"
import { type DownloadedSpec, type SpecFetch, wpJsonSpec } from "./spec-url.js"

/** The index a config names, with the WordPress version the config gives: the index does not say it. */
export const wordpressSpec = async (
  url: string | undefined,
  version: string | undefined,
  fetch: SpecFetch | undefined,
): Promise<DownloadedSpec | undefined> => {
  if (version === undefined)
    throw new Error("--spec wp-json comes from wirecat.config.ts, which names the WordPress version")
  return url === undefined ? undefined : wpJsonSpec(url, version, fetch)
}

/** An application password is the owner's site's own: its session takes --site and --login. */
export const configSeedOf = (loaded: LoadedConfig, path: string): string =>
  loaded.config.auth.preset === "app-password" && path.startsWith("src/commands/session")
    ? path.replace("session", "session-site")
    : path

// The README's WordPress parts: the sign-in on the owner's own site, and which key guards what.

export const wordpressSignIn = (cli: string): string[] => [
  "",
  `Sign in once with \`${cli} personal session start --site blog.example.com --login <user>\`. It asks for an`,
  "application password, made in your WordPress profile, checks it on that site, and keeps both together (in the",
  "keyring, unless `--credential-storage` says otherwise).",
  "The password goes to that site alone, never to another site on the same host.",
]

export const WORDPRESS_KEYS: readonly string[] = [
  "## What needs which key",
  "",
  "- **Publishing** needs `<route>.publish` (`posts.publish`, `pages.publish`): a write that sets `status` to",
  "  `publish` or `future`, or that sets `date`, `date_gmt` or `password`, unless the same call sets `status` to",
  "  `draft`, `pending` or `private`. WordPress publishes a scheduled post whose date moves into the past, and a",
  "  password taken off a published post makes it public, with no status in the call. `private` is not public.",
  "  Where a route's `status` starts at `publish` (menu items, for one), each create needs the key, as the",
  "  write publishes unless it says otherwise.",
  "- **Deleting** needs `<route>.delete`; with `force=true`, which deletes for good instead of moving to the trash,",
  "  it needs `<route>.delete.force` too. Both ask by default.",
  "- WordPress's batch route (`batch/v1`) is never offered: one batch call would run other routes' writes past",
  "  their keys.",
  "",
  "Known limit of the raw `api` group: WordPress publishes a scheduled post whose time has already passed (a",
  "missed schedule) on any edit, a title change too. The CLI cannot see that without reading the post first.",
  "",
]
