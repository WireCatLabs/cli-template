import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll } from "vitest"
import { ARGV_LOG } from "./argv-log.js"

const saved = { ...process.env }

// cli-base's setup already gave this file a fresh TMPDIR and HOME, a keyring that throws and no network.
const sandbox = tmpdir()
process.env.CLIDEV_CONFIG_DIR = join(sandbox, "config")
process.env.CLIDEV_STATE_DIR = join(sandbox, "state")
process.env.CLIDEV_CACHE_DIR = join(sandbox, "cache")
process.env.MESSAGING_STORE = join(sandbox, "messages.db")
process.env.WIRECAT_STATE_DIR = join(sandbox, "wirecat")
process.env.CLIDEV_NO_UPDATE_CHECK = "1"
process.env.CLIDEV_TEST_ARGV_LOG = ARGV_LOG
delete process.env.CLIDEV_PROFILE
delete process.env.CLIDEV_READ_ONLY
delete process.env.AI_AGENT
delete process.env.CLAUDECODE

afterAll(() => {
  for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]
  Object.assign(process.env, saved)
})
