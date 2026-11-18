import { CliError } from "@wirecat/cli-base"
import { retrying } from "@wirecat/cli-base/http"
import { openAppStore, recalledAccount, serviceApiCall } from "@wirecat/cli-core/cli"
import { crmSourceFromManifest } from "@wirecat/cli-core/crm"
import { addCrmCommands, type CrmRun, openCrmStore } from "@wirecat/cli-core/crm/cli"
import { Pacer, pacePathFor } from "@wirecat/cli-core/sends"
import { Command } from "commander"
import { API } from "../config.js"
import { contextOf, PACE, tokenOf } from "../context.js"
import { HOOK_OPTIONS, LIVE, SOURCE } from "../generated/wirecat-config.js"
import { IDENTITY } from "../identity.js"
import { serviceFetch } from "./api.js"

// The account is the one `session start` checked the token against; the store keeps each account's rows apart.
const accountOf = (command: Command) => {
  const { env, profile } = contextOf(command)
  const account = recalledAccount(IDENTITY, SOURCE.provider, profile, env)
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
    provider: SOURCE.provider,
    // The shared store, with this CLI's provider entry written so every other CLI's search knows it (WC-ARCH-21).
    open: (at, options) =>
      openAppStore(at, {
        app: IDENTITY,
        provider: { name: SOURCE.provider, kind: "crm", aliases: [], command: IDENTITY.command },
        ...options,
      }),
    account: () => accountOf(command),
  })
  const fetch = retrying(serviceFetch(environment), { pacer: new Pacer(pacePathFor(IDENTITY, profile, env), PACE) })
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
    source: () => (source ??= crmSourceFromManifest(SOURCE, { api: API.manifest, call, ...HOOK_OPTIONS })),
    close: () => store.close(),
  }
}

/** cli-core's CRM commands over the source wirecat.config.ts describes: sync, store status, deals, search. */
export const crmCommands = (): Command[] => {
  const holder = new Command(IDENTITY.command)
  addCrmCommands(holder, {
    app: IDENTITY,
    open,
    leads: SOURCE.kinds.includes("lead"),
    // People and companies whose entity names a search, and the users when the source names a call for them.
    live: LIVE,
  })
  return [...holder.commands]
}
