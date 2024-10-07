import * as core from '@actions/core'
import * as github from '@actions/github'
import * as path from 'path'
import * as io from '@actions/io'
import * as exec from '@actions/exec'

import * as gradle from './gradle'
import * as utils from './utils'
import * as diff from './diff'
import {
  BASE_DEPENDENCIES_DIR_NAME,
  BASE_REPO_DIR_NAME,
  CURRENT_DEPENDENCIES_DIR_NAME,
  GradleOptions,
  Inputs,
  TempDirs
} from './types'
import * as reporter from './reporter'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // get input values
    const inputs = getInputs()
    const gradleOptions = getGradleOptions(inputs)

    // create temp directories
    const tempDirs = await createTempDirs()

    // clone base repository
    const gitUrl = getGitUrl(inputs.token)
    await cloneBaseRepository(gitUrl, tempDirs.baseRepo)

    // download jar
    const jarPath = await diff.downloadJar(inputs.toolVersion, tempDirs.root)

    // generate dependencies txt
    await gradle.generateDependenciesFiles(
      gradleOptions,
      tempDirs.currentDependencies
    )
    await gradle.generateDependenciesFiles(
      gradleOptions,
      tempDirs.baseDependencies,
      tempDirs.baseRepo
    )

    // calculate diff
    const diffResults = await diff.calculateDiff(jarPath, tempDirs)

    // report
    const octokit = github.getOctokit(inputs.token, {
      baseUrl: github.context.apiUrl
    })
    const checksUrl = await reporter.reportAsChecks(octokit, diffResults)
    if (inputs.postPrComment) {
      await reporter.reportAsPrComment(octokit, checksUrl, diffResults)
    }
    if (inputs.updatePrBody) {
      await reporter.reportAsPrBody(octokit, checksUrl, diffResults)
    }
    if (inputs.assignLabel) {
      await reporter.reportAsLabel(octokit, diffResults, inputs.labelName)
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error)
    }
  }
}

function getInputs(): Inputs {
  return {
    includeProjectRegex: core.getInput('include-project-regex'),
    excludeProjectRegex: core.getInput('exclude-project-regex'),
    includeRootProject: core.getBooleanInput('include-root-project'),
    configurations: core.getInput('configurations'),
    token: core.getInput('token'),
    toolVersion: core.getInput('tool-version'),
    postPrComment: core.getBooleanInput('post-pr-comment'),
    updatePrBody: core.getBooleanInput('update-pr-body'),
    assignLabel: core.getBooleanInput('assign-label'),
    labelName: core.getInput('label-name')
  }
}

function getGradleOptions(inputs: Inputs): GradleOptions {
  return {
    includeProjectRegex: inputs.includeProjectRegex,
    excludeProjectRegex: inputs.excludeProjectRegex,
    includeRootProject: inputs.includeRootProject,
    configurations: inputs.configurations
  }
}

async function createTempDirs(): Promise<TempDirs> {
  const tempDir = await utils.createTempDirectory()

  const baseRepo = path.join(tempDir, BASE_REPO_DIR_NAME)
  const baseDependencies = path.join(tempDir, BASE_DEPENDENCIES_DIR_NAME)
  const currentDependencies = path.join(tempDir, CURRENT_DEPENDENCIES_DIR_NAME)

  await io.mkdirP(baseRepo)
  await io.mkdirP(baseDependencies)
  await io.mkdirP(currentDependencies)

  return {
    root: tempDir,
    baseRepo: baseRepo,
    baseDependencies: baseDependencies,
    currentDependencies: currentDependencies
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

export async function cloneBaseRepository(
  gitUrl: string,
  baseRepoDir: string
): Promise<void> {
  await exec.exec('git', ['clone', '--depth', '1', gitUrl, baseRepoDir])
  await exec.exec(
    'git',
    ['checkout', github.context.payload.pull_request?.base.sha],
    { cwd: baseRepoDir }
  )
}
