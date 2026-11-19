import { CliError } from "@wirecat/cli-base"
import { retrying } from "@wirecat/cli-base/http"
import { baseContext, recalledAccount, serviceApiCall, serviceApiWriter } from "@wirecat/cli-core/cli"
import {
  addContentCommands,
  type ContentRun,
  contentSourceFromManifest,
  contentWriterFromManifest,
} from "@wirecat/cli-core/content"
import { openCrmStore } from "@wirecat/cli-core/crm/cli"
import { Pacer, pacePathFor } from "@wirecat/cli-core/sends"
import type { MessageStore } from "@wirecat/cli-core/store"
import { Command } from "commander"
import { API, configuration } from "../config.js"
import { contextOf, PACE, tokenOf } from "../context.js"
import { SOURCE } from "../generated/wirecat-config.js"
import { IDENTITY } from "../identity.js"
import { API_OPTIONS, serviceFetch, siteOf } from "./api.js"

// Posts are not a kind the shared search reads yet, so the store gets no provider entry.
const openStore = async (env: NodeJS.ProcessEnv, { readOnly = false } = {}): Promise<MessageStore> => {
  const { ensureSqlite } = await import("@wirecat/cli-core/sqlite-runtime")
  await ensureSqlite()
  const { openStore: open, storePath } = await import("@wirecat/cli-core/store")
  return open({
    path: storePath(env),
    env,
    command: IDENTITY.command,
    version: IDENTITY.version,
    ...(readOnly ? { readOnly } : {}),
  })
}

// The account is the one `session start` checked the password against; the store keeps each account's rows apart.
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

// Every write goes through the api group's own write path, with its keys: never a second door.
const write = serviceApiWriter(API_OPTIONS)

const open = async (command: Command, { readOnly }: { readOnly: boolean }): Promise<ContentRun> => {
  const { env, profile, environment } = contextOf(command)
  const { store, account } = await openCrmStore({
    app: IDENTITY,
    env,
    profile,
    readOnly,
    provider: SOURCE.provider,
    open: openStore,
    account: () => accountOf(command),
  })
  let source: ReturnType<typeof contentSourceFromManifest> | undefined
  // Built on first use: a command that only reads the store never reads the sign-in.
  const sourceOf = () => {
    if (source) return source
    const { site } = siteOf(command)
    const fetch = retrying(serviceFetch(environment, site), {
      pacer: new Pacer(pacePathFor(IDENTITY, profile, env), PACE),
    })
    const call = serviceApiCall({
      manifest: API.manifest,
      service: API.service,
      serverVariables: { site },
      fetch,
      token: () => tokenOf(command),
    })
    source = contentSourceFromManifest(SOURCE, { api: API.manifest, call, site })
    return source
  }
  return {
    account,
    store,
    env,
    source: sourceOf,
    writes: (invoked) => ({
      writer: contentWriterFromManifest(SOURCE, {
        api: API.manifest,
        command: invoked,
        source: sourceOf(),
        // The keys the posts command already asked about are not asked again; deny and readonly still refuse.
        write: (on, operation, input, confirmed) => write(on, operation, input, { confirmed }),
      }),
      app: IDENTITY,
      env,
      settings: () => baseContext(invoked, configuration.resolveSettings).settings,
    }),
    close: () => store.close(),
  }
}

/** cli-core's content commands over the source wirecat.config.ts describes: sync, posts, terms and channels. */
export const contentCommands = (): Command[] => {
  const holder = new Command(IDENTITY.command)
  addContentCommands(holder, { app: IDENTITY, open, writes: SOURCE.writes !== undefined })
  return [...holder.commands]
}
