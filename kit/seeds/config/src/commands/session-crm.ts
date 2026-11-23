import { manifestVerify, tokenSessionCommand } from "@wirecat/cli-core/cli"
import { crmAccountClaim } from "@wirecat/cli-core/crm/cli"
import type { Command } from "commander"
import { API, configuration } from "../config.js"
import { contextOf } from "../context.js"
import { VERIFY } from "../generated/wirecat-config.js"
import { IDENTITY } from "../identity.js"
import { serviceFetch } from "./api.js"
import { CRM_ACCOUNT } from "./crm.js"

/**
 * `session start | status | end | list` (WC-ACCT-12): the token is checked by the call `auth.verify` names in
 * wirecat.config.ts, and the account is the id and name its answer holds. A second profile may not sign in to an
 * account another profile here holds.
 */
export const sessionCommand = (): Command =>
  tokenSessionCommand({
    app: IDENTITY,
    service: API.service,
    resolveSettings: configuration.resolveSettings,
    verify: manifestVerify({
      manifest: API.manifest,
      service: API.service,
      verify: VERIFY,
      fetch: (command) => serviceFetch(contextOf(command).environment),
    }),
    claim: crmAccountClaim(IDENTITY, CRM_ACCOUNT),
  })
