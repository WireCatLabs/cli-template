import { fakeApi } from "@wirecat/cli-base/codegen"
import { manifestBaseUrl } from "@wirecat/cli-core/cli"
import { API } from "../config.js"
import { definitions } from "../generated/definitions.js"

/** The token fakeServiceApi takes; never a real one (WC-TEST-2). */
export const FAKE_API_TOKEN = "fake0api0token"

/** The service's API as its description says, answering only `token`: a sample of each answer schema. */
export const fakeServiceApi = (token = FAKE_API_TOKEN) =>
  fakeApi({
    operations: API.manifest.operations,
    definitions,
    baseUrl: manifestBaseUrl(API.manifest),
    security: API.manifest.security,
    securitySchemes: API.manifest.securitySchemes,
    token,
  })

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

/** The API's host goes to fakeServiceApi, any other to `rest` (the sample's fake while the sample stays). */
export const withServiceApi = (rest: { fetch: Fetch }, token: string): { fetch: Fetch } => {
  const api = fakeServiceApi(token)
  const host = new URL(manifestBaseUrl(API.manifest)).host
  return {
    fetch: (input, init) =>
      new URL(input instanceof Request ? input.url : input).host === host
        ? api.fetch(input, init)
        : rest.fetch(input, init),
  }
}
