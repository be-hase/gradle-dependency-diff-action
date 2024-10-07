// From https://github.com/actions/toolkit/blob/c18a7d2f7347ca2fef6a2e455c6842611eb5f5d6/packages/cache/src/internal/cacheUtils.ts
import * as path from 'node:path'
import * as io from '@actions/io'

export async function createTempDirectory(): Promise<string> {
  const IS_WINDOWS = process.platform === 'win32'

  let tempDirectory: string = process.env['RUNNER_TEMP'] || ''

  if (!tempDirectory) {
    let baseLocation: string
    if (IS_WINDOWS) {
      // On Windows use the USERPROFILE env variable
      baseLocation = process.env['USERPROFILE'] || 'C:\\'
    } else {
      if (process.platform === 'darwin') {
        baseLocation = '/Users'
      } else {
        baseLocation = '/home'
      }
    }
    tempDirectory = path.join(baseLocation, 'actions', 'temp')
  }

  const dest = path.join(tempDirectory, crypto.randomUUID())
  await io.mkdirP(dest)
  return dest
}
