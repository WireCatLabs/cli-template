import { type CredentialSource, Credentials, isMovedRun, type KeyringStore, resolvePaths } from "@wirecat/cli-base"
import { IDENTITY } from "./identity.js"

export const TOKEN_VARIABLE = `${IDENTITY.envPrefix}_TOKEN`

export type TokenStorage = "keyring" | "file"

/**
 * One token per profile: `CLIDEV_TOKEN`, then the keyring entry `token:<profile>` under the app's name, then a 0600
 * file (WC-SECR-4). A run with moved folders reads the owner's entry and never replaces or deletes it (WC-SECR-24);
 * cli-base's `Credentials` does both. cli-core has no token store for a CLI that is not a bot; keep this one.
 */
export const tokenStore = (
  env: NodeJS.ProcessEnv,
  keyring: KeyringStore | undefined,
  warn: (message: string) => void,
) => {
  const where = { appName: IDENTITY.appName, prefix: IDENTITY.envPrefix, env }
  const options = {
    configDir: resolvePaths(where).config,
    service: IDENTITY.appName,
    envVar: TOKEN_VARIABLE,
    isolated: isMovedRun(where),
    env,
    ...(keyring ? { keyring } : {}),
    warn,
  }
  const credentials = new Credentials(options)
  const account = (profile: string) => `token:${profile}`
  return {
    read: (profile: string) => credentials.read(account(profile)),
    write: (profile: string, token: string, storage: TokenStorage): CredentialSource =>
      new Credentials({ ...options, storage: storage === "file" ? "file" : "auto" }).write(account(profile), token, {
        signIn: true,
      }),
    remove: (profile: string): CredentialSource[] => credentials.remove(account(profile)),
  }
}

/** Whether the profile has a token here, for `mcp check`, which prints its own verdict. */
export const holdsToken = (env: NodeJS.ProcessEnv, profile: string, keyring?: KeyringStore): boolean =>
  tokenStore(env, keyring, () => {}).read(profile) !== undefined
