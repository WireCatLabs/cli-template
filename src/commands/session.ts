import { tokenSessionCommand } from "@wirecat/cli-core/cli"
import type { Command } from "commander"
import { configuration } from "../config.js"
import { serviceFor } from "../context.js"
import { IDENTITY, SERVICE } from "../identity.js"

/** A service signed in in the browser uses cli-core's `oauthSessionCommand` instead (WC-SECR-22). */
export const sessionCommand = (): Command =>
  tokenSessionCommand({
    app: IDENTITY,
    service: SERVICE,
    resolveSettings: configuration.resolveSettings,
    // SAMPLE: ask your service whose the token is. Add `guide`: the steps and links that make a token.
    verify: async (command, token, events) => {
      const user = await serviceFor(command, token, events).me()
      return { id: user.id, account: user }
    },
  })
