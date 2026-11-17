import { fakeApi } from "@wirecat/cli-base/codegen"
import { manifestBaseUrl } from "@wirecat/cli-core/cli"
import { API } from "../config.js"
import { definitions } from "../generated/definitions.js"
import { FAKE_TOKEN } from "./fake-comments.js"

/** The service's API as its description says, answering only FAKE_TOKEN: a sample of each answer schema. */
export const fakeServiceApi = () =>
  fakeApi({
    operations: API.manifest.operations,
    definitions,
    baseUrl: manifestBaseUrl(API.manifest),
    security: API.manifest.security,
    securitySchemes: API.manifest.securitySchemes,
    token: FAKE_TOKEN,
  })

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

/** The API's host goes to fakeServiceApi, any other to `rest` (the sample's fake while the sample stays). */
export const withServiceApi = (rest: { fetch: Fetch }): { fetch: Fetch } => {
  const api = fakeServiceApi()
  const host = new URL(manifestBaseUrl(API.manifest)).host
  return {
    fetch: (input, init) =>
      new URL(input instanceof Request ? input.url : input).host === host
        ? api.fetch(input, init)
        : rest.fetch(input, init),
  }
}
