import { fakeApi, graphqlFake, sampleOf } from "@wirecat/cli-base/codegen"
import { manifestBaseUrl } from "@wirecat/cli-core/cli"
import { API } from "../config.js"
import { definitions } from "../generated/definitions.js"
import { VERIFY } from "../generated/wirecat-config.js"

// A service on the owner's own site, whose server names `{site}`, is answered at this one.
const sited = API.manifest.servers?.[0]?.url.includes("{site}") === true

/** The site session start --site names in a test; a made-up address that never resolves. */
export const FAKE_SITE = "blog.example.test"

/** The token fakeServiceApi takes; never a real one (WC-TEST-2). On a site it is a user name and password, by Basic. */
export const FAKE_API_TOKEN = sited ? "fake0user:fake0password" : "fake0api0token"

const graphql = API.manifest.operations.some((operation) => operation.binding.kind === "graphql")

// A GraphQL schema names no sign-in: the header is the one scripts/generate.ts sets in `auth`.
const graphqlAuth = (token: string) => {
  const scheme = Object.values(API.manifest.securitySchemes ?? {})[0] as { type?: string; in?: string; name?: string }
  return scheme?.type === "apiKey" && scheme.in === "header" && scheme.name
    ? { header: scheme.name, value: token }
    : { header: "Authorization", value: `Bearer ${token}` }
}

/** The answer of the call auth.verify names, with the token marked active where auth.verify.active says. */
const verifyAnswer = (): Record<string, () => { body: unknown }> => {
  const operation = API.manifest.operations.find((one) => one.id === VERIFY.operation)
  const schema = operation?.response?.schema
  const active = VERIFY.active
  if (!active || !schema) return {}
  return {
    [VERIFY.operation]: () => {
      const body = sampleOf({ type: "ref", ref: schema }, definitions)
      const keys = active.split(".")
      const last = keys.pop() as string
      let here = body as Record<string, unknown>
      for (const key of keys) {
        here[key] ??= {}
        here = here[key] as Record<string, unknown>
      }
      here[last] = true
      return { body }
    },
  }
}

/** The service's API as its description says, answering only `token`: a sample of each answer schema. */
export const fakeServiceApi = (token = FAKE_API_TOKEN) =>
  graphql
    ? graphqlFake({
        operations: API.manifest.operations,
        definitions,
        url: manifestBaseUrl(API.manifest, undefined, { site: FAKE_SITE }),
        auth: graphqlAuth(token),
      })
    : fakeApi({
        operations: API.manifest.operations,
        definitions,
        baseUrl: manifestBaseUrl(API.manifest, undefined, { site: FAKE_SITE }),
        security: API.manifest.security,
        securitySchemes: API.manifest.securitySchemes,
        token,
        answers: verifyAnswer(),
      })
