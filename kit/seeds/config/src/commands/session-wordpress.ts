import { manifestVerify, tokenSessionCommand } from "@wirecat/cli-core/cli"
import type { Command } from "commander"
import { API, configuration } from "../config.js"
import { contextOf } from "../context.js"
import { VERIFY } from "../generated/wirecat-config.js"
import { IDENTITY } from "../identity.js"
import { serviceFetch } from "./api.js"

/**
 * `session start --site <address> --login <name> | status | end | list` (WC-ACCT-12): the WordPress application
 * password is asked hidden, checked on that site by the call `auth.verify` names in wirecat.config.ts, and kept with
 * the site, so it only ever goes there. The account is the id and name the answer holds.
 */
export const sessionCommand = (): Command =>
  tokenSessionCommand({
    app: IDENTITY,
    service: API.service,
    resolveSettings: configuration.resolveSettings,
    token: "application password",
    site: { example: "blog.example.com" },
    login: { page: (site) => `https://${site}/wp-admin/profile.php#application-passwords-section` },
    about: "Make an application password in your WordPress profile; it can do what your user can, no more.",
    verify: manifestVerify({
      manifest: API.manifest,
      service: API.service,
      verify: VERIFY,
      // session start refuses a sign-in without --site before it checks one.
      fetch: (command, site) => serviceFetch(contextOf(command).environment, site as string),
    }),
  })
