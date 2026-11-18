import { withoutMount } from "./sample.js"
import { replaceOnce } from "./spec.js"

// A config whose `auth.verify` checks the token against the API has a fake of that API, so the CLI it makes starts on
// the API, not on the template's sample: `new` leaves the sample's files out and these rewrite the files that used it.
// `remove-sample` refused such a CLI before, since its wiring imported the sample.

const each = (file: string, text: string, pairs: readonly [string | RegExp, string][]): string =>
  pairs.reduce((rest, [from, to]) => replaceOnce(file, rest, from, to), text)

const CONTEXT = "src/context.ts"
const withoutSampleContext = (text: string): string => {
  const kept = each(CONTEXT, text, [
    ["  type EventSink,\n", ""],
    ['import { Pacer, pacePathFor } from "@wirecat/cli-core/sends"\n', ""],
    [/^import \{ type CommentsService, commentsService \} from "\.\/sample\/comments\.js"\n/m, ""],
    [/^import \{ transport \} from "\.\/sample\/transport\.js"\n/m, ""],
  ])
  // The sample's service and its run wrapper go: the api group and the CRM commands run their own calls.
  return each(CONTEXT, kept, [
    [/\n\/\*\* The service for one run[\s\S]*?\n}\n/, "\n"],
    [/\n\/\*\*\n \* Every remote call goes through here[\s\S]*?\n}\n/, ""],
  ])
}

const PROGRAM = "src/program.ts"
const withoutSampleProgram = (text: string): string =>
  each(PROGRAM, withoutMount(text), [
    ['untrusted: ["comment text", "author names"],', 'untrusted: ["names and text the service\'s users wrote"],'],
    ['permissionExample: "comments.create=deny",', 'permissionExample: "api.list=deny",'],
  ])

const HARNESS = "src/testing/harness.ts"
const withoutSampleHarness = (text: string): string =>
  each(HARNESS, text, [
    [
      'import { FAKE_TOKEN, fakeComments } from "./fake-comments.js"\n',
      'import { FAKE_API_TOKEN as FAKE_TOKEN, fakeServiceApi } from "./fake-api.js"\n',
    ],
    ["service = fakeComments(),", "service = fakeServiceApi(),"],
  ])

const MCP = "src/mcp.test.ts"
const withoutSampleMcp = (text: string): string =>
  each(MCP, text, [
    [
      'import { fakeComments } from "./testing/fake-comments.js"\n',
      'import { fakeServiceApi } from "./testing/fake-api.js"\n',
    ],
    ['"comments.nope=deny"', '"api.nope=deny"'],
    ['toContain("comments.nope")', 'toContain("api.nope")'],
    [/"comments\.create=deny"/g, '"api.list=deny"'],
    ['{ permissions: { "comments.list": "deny" } }', '{ permissions: { "api.list": "deny" } }'],
    ["const service = fakeComments()", "const service = fakeServiceApi()"],
    ['{ query: "comments list" }', '{ query: "api list" }'],
    [/command: "comments list"/g, 'command: "api list"'],
  ])

const RUN_SCOPE = "src/run-scope.test.ts"
export const withoutSampleRunScope = (text: string): string =>
  each(RUN_SCOPE, text, [
    [
      'import { FAKE_TOKEN, fakeComments } from "./testing/fake-comments.js"\n',
      'import { FAKE_API_TOKEN as FAKE_TOKEN, fakeServiceApi } from "./testing/fake-api.js"\n',
    ],
    [/^ +"comments [a-z]+": \[.*\],\n/gm, ""],
    ["fetch: fakeComments().fetch", "fetch: fakeServiceApi().fetch"],
  ])

/**
 * run-scope over a config's wiring: `session start` checks the token with the API, so the answering fake is the API's,
 * the sample gone; `sync` is cli-core's, run in its own run and tested by the source's contracts test.
 */
export const withConfigRunScope = (
  text: string,
  { verifies, source, users = false }: { verifies: boolean; source?: "crm" | "tracker"; users?: boolean },
): string => {
  const answering = verifies ? withoutSampleRunScope(text) : text
  const sync = {
    crm: '      sync: "cli-core\'s addCrmCommands runs it in its run; src/crm-contracts.test.ts runs crmSyncContract",',
    tracker: '      sync: "cli-core\'s addTrackerCommands runs it in its run; src/tracker-contracts.test.ts syncs",',
  }
  return source
    ? replaceOnce(
        RUN_SCOPE,
        answering,
        '      "mcp serve": "listens until stopped",\n',
        [
          '      "mcp serve": "listens until stopped",',
          sync[source],
          ...(users
            ? [
                '      "users list": "cli-core\'s addCrmCommands runs it in its run, over source.users",',
                '      "users show": "cli-core\'s addCrmCommands runs it in its run, over source.users",',
              ]
            : []),
          "",
        ].join("\n"),
      )
    : answering
}

const API_TEST = "src/api.test.ts"
const withoutSampleApiTest = (text: string): string =>
  each(API_TEST, text, [
    [
      'import { FAKE_TOKEN } from "./testing/fake-comments.js"\n',
      'import { FAKE_API_TOKEN as FAKE_TOKEN } from "./testing/fake-api.js"\n',
    ],
  ])

const IDENTITY = "src/identity.ts"
const withoutSampleHost = (text: string): string =>
  each(IDENTITY, text, [
    [/^ *\/\/ SAMPLE: every host the CLI contacts.*\n/m, ""],
    [/"comments\.example\.invalid",? ?/, ""],
  ])

/** The rewrites of the files that used the sample, by path. */
export const OFF_SAMPLE: Readonly<Record<string, (text: string) => string>> = {
  [CONTEXT]: withoutSampleContext,
  [PROGRAM]: withoutSampleProgram,
  [HARNESS]: withoutSampleHarness,
  [MCP]: withoutSampleMcp,
  [API_TEST]: withoutSampleApiTest,
  [IDENTITY]: withoutSampleHost,
}
