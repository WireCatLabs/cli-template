// Renders the README's pictures from their sources: pnpm kit:images. Run it from the repository root.
// The banner needs Google Chrome. The GIF needs vhs with ttyd, and gifsicle to shrink it; it is skipped with a note
// when vhs or ttyd is missing. `--gif` renders only the GIF. `--local` runs the tape's `npx @wirecat/cli-template`
// from this checkout, packed and installed the way npx installs it, to record a change before it is on npm.
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const CHROME = process.env.CHROME ?? "/usr/bin/google-chrome"
const BANNER_SOURCE = resolve("kit/images/src/banner.html")
const BANNER = resolve("kit/images/banner.png")
const TAPE = resolve("kit/images/src/new.tape")
const GIF = resolve("kit/images/new.gif")

const has = (command: string) => {
  try {
    execFileSync("sh", ["-c", `command -v ${command}`], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

if (!process.argv.includes("--gif")) {
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
}

const localKit = (dir: string): Record<string, string> => {
  execFileSync("pnpm", ["build"], { stdio: "inherit" })
  const tarball = execFileSync("npm", ["pack", "--silent", "--ignore-scripts", "--pack-destination", dir], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .at(-1)
  execFileSync("npm", ["install", "--silent", "--no-save", "--prefix", dir, join(dir, tarball ?? "")], {
    stdio: "inherit",
  })
  return { KIT_BIN: join(dir, "node_modules/@wirecat/cli-template/kit/dist/main.js") }
}

if (has("vhs") && has("ttyd")) {
  const local = process.argv.includes("--local") ? mkdtempSync(join(tmpdir(), "kit-images-")) : undefined
  try {
    execFileSync("vhs", [TAPE], { stdio: "inherit", env: { ...process.env, ...(local ? localKit(local) : {}) } })
  } finally {
    if (local) rmSync(local, { recursive: true, force: true })
  }
  if (has("gifsicle"))
    execFileSync("gifsicle", ["-O3", "--lossy=80", "--colors", "64", "--resize-width", "1000", "-b", GIF])
  console.error(`${GIF}: ${Math.round(statSync(GIF).size / 1024)} KB`)
} else console.error(`skipped ${TAPE}: vhs needs ttyd (https://github.com/charmbracelet/vhs#installation)`)
