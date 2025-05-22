import * as core from '@actions/core'
import * as github from '@actions/github'
import * as path from 'path'
import * as io from '@actions/io'
import * as exec from '@actions/exec'

import * as gradle from './gradle.js'
import * as utils from './utils.js'
import * as diff from './diff.js'
import { DiffResult, Inputs, RESULT_DIR_NAME, TempDirs } from './types.js'
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

    // download jar
    const jarPath = await diff.downloadJar(inputs.toolVersion, tempDirs.root)

    // calculate diff
    const diffResults = await calculateDiffResults(
      jarPath,
      configurations,
      inputs.oldRepoDir,
      inputs.newRepoDir,
      tempDirs
    )
    const html = reporter.generateHtmlReport(diffResults, tempDirs.result)

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
    if (inputs.postPrComment) {
      await reporter.reportToPrComment(octokitHelper, urls, diffResults)
    }
    if (inputs.updatePrBody) {
      await reporter.reportToPrBody(octokitHelper, urls, diffResults)
    }
    if (inputs.assignLabel) {
      await reporter.reportToLabel(octokitHelper, diffResults, inputs.labelName)
    }
    if (diffResults.length !== 0 && inputs.uploadArtifact) {
      await reporter.reportToArtifact(tempDirs.result)
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
    oldRepoDir: core.getInput('old-repo-dir'),
    newRepoDir: core.getInput('new-repo-dir'),
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

  const result = path.join(tempDir, RESULT_DIR_NAME)

  await io.mkdirP(result)

  return {
    root: tempDir,
    result: result
  }
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
  oldRepoDir: string,
  newRepoDir: string,
  tempDirs: TempDirs
) {
  const diffResults: DiffResult[] = []
  for (const configuration of configurations) {
    await gradle.generateDependenciesFiles(configuration, oldRepoDir)
    await gradle.generateDependenciesFiles(configuration, newRepoDir)
    const configurationDiffResults = await diff.calculateDiffResults(
      jarPath,
      configuration,
      oldRepoDir,
      newRepoDir,
      tempDirs
    )
    diffResults.push(...configurationDiffResults)
  }
  return diff.sortDiffResults(diffResults)
}
