import { join } from "node:path"
import { type ApiModel, adaptOpenApi, type Override, readWpJson, wpJsonToOpenApi } from "@wirecat/cli-base/codegen"

// SAMPLE: the WordPress namespaces the CLI offers. A plugin's namespace belongs to the sites that run the plugin;
// batch/v1 is never offered, as one batch call runs other routes' writes past their own keys.
const NAMESPACES = ["wp/v2"]

/**
 * The index as committed; readWpJson refuses one whose hash no longer matches provenance.json. The routes left out,
 * and why, become the coverage page's notes; the overrides say how WordPress pages a list.
 */
export const specModel = async (
  root: string,
): Promise<{ model: ApiModel; notes: string[]; overrides: Record<string, Override> }> => {
  const index = readWpJson(join(root, "spec/clidev"))
  // An application password's answer is marked secret by the converter, and cli-core offers no api command for it.
  const { document, omissions, overrides } = wpJsonToOpenApi(index, {
    namespaces: NAMESPACES,
    // SAMPLE: route → why the CLI leaves it out, as { "/wp/v2/…": "reason" }.
    exclude: {},
  })
  return { model: adaptOpenApi(document), notes: omissions, overrides }
}
