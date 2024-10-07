import * as core from '@actions/core'
import * as github from '@actions/github'
import * as path from 'path'
import * as crypto from 'crypto'
import * as io from '@actions/io'
import * as exec from '@actions/exec'
import * as glob from '@actions/glob'
import { generateDependenciesFiles, ProjectOptions } from './gradle'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const projectOptions: ProjectOptions = {
      includeProjectRegex: core.getInput('include-project-regex'),
      excludeProjectRegex: core.getInput('exclude-project-regex'),
      includeRootProject: core.getBooleanInput('include-root-project'),
      configurations: core.getMultilineInput('configurations')
    }
    const token = core.getInput('token')

    const gitUrl = getGitUrl(token)
    const tempDir = await createTempDirectories()
    await cloneBaseRepository(gitUrl, tempDir)

    await generateDependenciesFiles(
      projectOptions,
      path.join(tempDir, 'current-dependencies')
    )
    await generateDependenciesFiles(
      projectOptions,
      path.join(tempDir, 'base-dependencies'),
      path.join(tempDir, 'base-repo')
    )

    let globber = await glob.create(
      path.join(tempDir, 'current-dependencies', '**', '*.txt')
    )
    let files = await globber.glob()
    console.log(files)
    globber = await glob.create(
      path.join(tempDir, 'base-dependencies', '**', '*.txt')
    )
    files = await globber.glob()
    console.log(files)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error)
    }
  }
}

export function getGitUrl(token: string): string {
  const url = new URL(github.context.serverUrl)
  if (token.startsWith('ghp_')) {
    url.username = token
  } else {
    url.username = 'x-access-token'
    url.password = token
  }
  return `${url.toString()}${github.context.repo.owner}/${github.context.repo.repo}`
}

export async function createTempDirectories(): Promise<string> {
  const tempDir = await createTempDirectory()
  await io.mkdirP(path.join(tempDir, `base-repo`))
  await io.mkdirP(path.join(tempDir, `base-dependencies`))
  await io.mkdirP(path.join(tempDir, `current-dependencies`))
  return tempDir
}

export async function cloneBaseRepository(
  gitUrl: string,
  tempDir: string
): Promise<void> {
  await exec.exec('git', [
    'clone',
    '--depth',
    '1',
    gitUrl,
    path.join(tempDir, 'base-repo')
  ])
  await exec.exec(
    'git',
    ['checkout', github.context.payload.pull_request?.base.sha],
    { cwd: path.join(tempDir, 'base-repo') }
  )
}

// From https://github.com/actions/toolkit/blob/c18a7d2f7347ca2fef6a2e455c6842611eb5f5d6/packages/cache/src/internal/cacheUtils.ts
async function createTempDirectory(): Promise<string> {
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
