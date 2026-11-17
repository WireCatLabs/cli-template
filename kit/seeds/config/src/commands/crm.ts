import { CliError } from "@wirecat/cli-base"
import { hostFetch, retrying } from "@wirecat/cli-base/http"
import { recalledAccount, serviceApiCall } from "@wirecat/cli-core/cli"
import { crmSourceFromManifest } from "@wirecat/cli-core/crm"
import { addCrmCommands, type CrmRun, openCrmStore } from "@wirecat/cli-core/crm/cli"
import { Pacer, pacePathFor } from "@wirecat/cli-core/sends"
import type { MessageStore } from "@wirecat/cli-core/store"
import { Command } from "commander"
import { API } from "../config.js"
import { contextOf, PACE, tokenOf } from "../context.js"
import { HOOKS, SOURCE } from "../generated/wirecat-config.js"
import { DESKTOP, IDENTITY } from "../identity.js"

const provider = (): string => {
  if (typeof SOURCE?.provider !== "string") throw new CliError("configuration_error", "wirecat.config.ts has no source")
  return SOURCE.provider
}

/**
 * The shared store, with this CLI's provider entry written, so every other CLI's search knows it (WC-ARCH-21). A
 * read-only open writes nothing, the entry included.
 */
const openStore = async (env: NodeJS.ProcessEnv, { readOnly = false } = {}): Promise<MessageStore> => {
  const { ensureSqlite } = await import("@wirecat/cli-core/sqlite-runtime")
  await ensureSqlite()
  const { openStore: open, storePath } = await import("@wirecat/cli-core/store")
  const store = await open({
    path: storePath(env),
    env,
    command: IDENTITY.command,
    version: IDENTITY.version,
    ...(readOnly ? { readOnly } : {}),
  })
  try {
    if (!readOnly)
      await store.accounts.registerProvider({ name: provider(), kind: "crm", aliases: [], command: IDENTITY.command })
    return store
  } catch (error) {
    await store.close()
    throw error
  }
}

// The account is the one `session start` checked the token against; the store keeps each account's rows apart.
const accountOf = (command: Command) => {
  const { env, profile } = contextOf(command)
  const account = recalledAccount(IDENTITY, provider(), profile, env)
  if (!account)
    throw new CliError(
      "authentication_error",
      `${profile} is not signed in; run ${IDENTITY.command} ${profile} session start`,
      {
        reason: "auth.missing",
      },
    )
  return account
}

const open = async (command: Command, { readOnly }: { readOnly: boolean }): Promise<CrmRun> => {
  const { env, profile, environment } = contextOf(command)
  const { store, account } = await openCrmStore({
    app: IDENTITY,
    env,
    profile,
    readOnly,
    provider: provider(),
    open: openStore,
    account: () => accountOf(command),
  })
  const fetch = retrying(
    hostFetch({ hosts: DESKTOP.hosts ?? [], ...(environment.fetch ? { fetch: environment.fetch } : {}) }),
    { pacer: new Pacer(pacePathFor(IDENTITY, profile, env), PACE) },
  )
  const call = serviceApiCall({ manifest: API.manifest, service: API.service, fetch, token: () => tokenOf(command) })
  let source: ReturnType<typeof crmSourceFromManifest> | undefined
  return {
    profile,
    account,
    // A CRM that limits its users is not described by a manifest yet; nobody's rows are hidden.
    user: null,
    store,
    env,
    locked: Boolean(env[`${IDENTITY.envPrefix}_PROFILE_LOCK`]),
    source: () =>
      (source ??= crmSourceFromManifest(SOURCE, { api: API.manifest, call, ...(HOOKS ? { hooks: HOOKS } : {}) })),
    close: () => store.close(),
  }
}

/** cli-core's CRM commands over the source wirecat.config.ts describes: sync, store status, deals, search. */
export const crmCommands = (): Command[] => {
  const holder = new Command(IDENTITY.command)
  addCrmCommands(holder, {
    app: IDENTITY,
    open,
    leads: Array.isArray(SOURCE?.kinds) && SOURCE.kinds.includes("lead"),
  })
  return [...holder.commands]
}
