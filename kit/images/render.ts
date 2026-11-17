// Renders the README's pictures from their sources: pnpm kit:images. Run it from the repository root.
// The banner needs Google Chrome. The GIF needs vhs with ttyd, and is skipped with a note when either is missing.
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const CHROME = process.env.CHROME ?? "/usr/bin/google-chrome"
const BANNER_SOURCE = resolve("kit/images/src/banner.html")
const BANNER = resolve("kit/images/banner.png")
const TAPE = resolve("kit/images/src/new.tape")

const has = (command: string) => {
  try {
    execFileSync("sh", ["-c", `command -v ${command}`], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

if (!existsSync(CHROME)) throw new Error(`${CHROME} not found; set CHROME to a Chrome or Chromium binary`)
execFileSync(
  CHROME,
  [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=1280,640",
    `--screenshot=${BANNER}`,
    pathToFileURL(BANNER_SOURCE).href,
  ],
  { stdio: "inherit" },
)

if (has("vhs") && has("ttyd")) execFileSync("vhs", [TAPE], { stdio: "inherit" })
else console.error(`skipped ${TAPE}: vhs needs ttyd (https://github.com/charmbracelet/vhs#installation)`)
