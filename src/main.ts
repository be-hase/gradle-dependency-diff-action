import * as core from '@actions/core'
import * as github from '@actions/github'
import * as path from 'path'
import * as io from '@actions/io'
import * as exec from '@actions/exec'

import * as gradle from './gradle.js'
import * as utils from './utils.js'
import * as diff from './diff.js'
import {
  BASE_REPO_DIR_NAME,
  DiffResult,
  Inputs,
  RESULT_DIR_NAME,
  TempDirs
} from './types.js'
import * as reporter from './reporter.js'
import { getOctokitHelper } from './octokitHelper.js'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // get input values
    const inputs = getInputs()
    const configurations = inputs.configurations
      .split(',')
      .map((it) => it.trim())

    // create temp directories
    const tempDirs = await createTempDirs()

    // clone base repository
    const gitUrl = getGitUrl(inputs.token)
    await cloneBaseRepository(gitUrl, tempDirs.baseRepo)

    // download jar
    const jarPath = await diff.downloadJar(inputs.toolVersion, tempDirs.root)

    // calculate diff
    const diffResults = await calculateDiffResults(
      jarPath,
      configurations,
      tempDirs
    )
    const html = reporter.generateHtmlReport(diffResults)

    const octokit = github.getOctokit(inputs.token, {
      baseUrl: github.context.apiUrl
    })
    const octokitHelper = getOctokitHelper(octokit)

    // report
    let urls: string[]
    if (inputs.customEndpointUrl.length > 0) {
      urls = await reporter.reportToCustomEndpoint(
        inputs.customEndpointUrl,
        inputs.customEndpointHeaders,
        html
      )
    } else {
      urls = await reporter.reportToChecks(octokitHelper, diffResults)
    }
    if (urls.length !== 0) {
      if (inputs.postPrComment) {
        await reporter.reportToPrComment(octokitHelper, urls, diffResults)
      }
      if (inputs.updatePrBody) {
        await reporter.reportToPrBody(octokitHelper, urls, diffResults)
      }
    }
    if (inputs.assignLabel) {
      await reporter.reportToLabel(octokitHelper, diffResults, inputs.labelName)
    }
    if (diffResults.length !== 0 && inputs.uploadArtifact) {
      await reporter.reportToArtifact(tempDirs.result, html as string)
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
    configurations: core.getInput('configurations'),
    token: core.getInput('token'),
    toolVersion: core.getInput('tool-version'),
    postPrComment: core.getBooleanInput('post-pr-comment'),
    updatePrBody: core.getBooleanInput('update-pr-body'),
    assignLabel: core.getBooleanInput('assign-label'),
    labelName: core.getInput('label-name'),
    uploadArtifact: core.getBooleanInput('upload-artifact'),
    customEndpointUrl: core.getInput('custom-endpoint-url'),
    customEndpointHeaders: core.getMultilineInput('custom-endpoint-headers')
  }
}

// export for testing
export async function createTempDirs(): Promise<TempDirs> {
  const tempDir = await utils.createTempDirectory()

  const baseRepo = path.join(tempDir, BASE_REPO_DIR_NAME)
  const result = path.join(tempDir, RESULT_DIR_NAME)

  await io.mkdirP(baseRepo)
  await io.mkdirP(result)

  return {
    root: tempDir,
    baseRepo: baseRepo,
    result: result
  }
}

// export for testing
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

// export for testing
export async function cloneBaseRepository(
  gitUrl: string,
  baseRepoDir: string
): Promise<void> {
  await exec.exec('git', [
    'clone',
    '--depth',
    '1',
    '-b',
    github.context.payload.pull_request?.base.ref,
    gitUrl,
    baseRepoDir
  ])
}

// export for testing
export async function calculateDiffResults(
  jarPath: string,
  configurations: string[],
  tempDirs: TempDirs
) {
  const diffResults: DiffResult[] = []
  for (const configuration of configurations) {
    await gradle.generateDependenciesFiles(configuration)
    await gradle.generateDependenciesFiles(configuration, tempDirs.baseRepo)
    const configurationDiffResults = await diff.calculateDiffResults(
      jarPath,
      configuration,
      tempDirs
    )
    diffResults.push(...configurationDiffResults)
  }
  return diff.sortDiffResults(diffResults)
}
