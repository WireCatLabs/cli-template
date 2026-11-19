// Preloaded into `new --from-config` by kit/e2e.sh: answers the config's spec URL from a file, so the run reaches no
// service. A config's spec.from must be https, so a local server cannot stand in. Every other request goes on as sent.
import { readFileSync } from "node:fs"

const { E2E_SPEC_URL: url, E2E_SPEC_FILE: file } = process.env
const send = globalThis.fetch
// A WordPress index is asked with ?context=help, for every route's arguments and schema.
const asked = (input) => String(input instanceof Request ? input.url : input).replace(/\?context=help$/, "")
globalThis.fetch = (input, init) =>
  asked(input) === url
    ? Promise.resolve(new Response(readFileSync(file), { headers: { "content-type": "application/json" } }))
    : send(input, init)
