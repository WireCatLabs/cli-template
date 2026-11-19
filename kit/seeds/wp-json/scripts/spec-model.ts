import { join } from "node:path"
import { type ApiModel, adaptOpenApi, type Override, readWpJson, wpJsonToOpenApi } from "@wirecat/cli-base/codegen"

// SAMPLE: the WordPress namespaces the CLI offers. A plugin's namespace belongs to the sites that run the plugin;
// batch/v1 is never offered, as one batch call runs other routes' writes past their own keys.
const NAMESPACES = ["wp/v2"]
const APPLICATION_PASSWORDS = "/wp/v2/users/(?P<user_id>(?:[\\d]+|me))/application-passwords"

/**
 * The index as committed; readWpJson refuses one whose hash no longer matches provenance.json. The routes left out,
 * and why, become the coverage page's notes; the overrides say how WordPress pages a list.
 */
export const specModel = async (
  root: string,
): Promise<{ model: ApiModel; notes: string[]; overrides: Record<string, Override> }> => {
  const index = readWpJson(join(root, "spec/clidev")) as { routes?: Record<string, unknown> }
  const { document, omissions, overrides } = wpJsonToOpenApi(index, {
    namespaces: NAMESPACES,
    // SAMPLE: route → why the CLI leaves it out. WordPress answers a new application password in clear and the index
    // marks no field secret, so cli-core cannot leave that one out itself; its list and delete-all go with it.
    exclude: Object.fromEntries(
      [APPLICATION_PASSWORDS]
        .filter((route) => index.routes?.[route])
        .map((route) => [route, "its POST answers a new application password in clear. Sign in with session start"]),
    ),
  })
  return { model: adaptOpenApi(document), notes: omissions, overrides }
}
