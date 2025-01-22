import { GitHub } from '@actions/github/lib/utils.js'
import * as github from '@actions/github'
import { DiffResult } from './types.js'
import { OctokitHelper } from './octokitHelper.js'

const CHECKS_NAME = 'Report of gradle-dependency-diff-action'
const TAG = '<!-- gradle-dependency-diff-action -->'
const PR_BODY_TAG_PATTERN = new RegExp(`${TAG}[\\s\\S]*${TAG}`)

export async function reportAsChecks(
  octokit: InstanceType<typeof GitHub>,
  diffResults: DiffResult[]
): Promise<string> {
  const sha = github.context.payload.pull_request!.head.sha
  const conclusion = diffResults.length == 0 ? 'success' : 'neutral'
  const output = getChecksOutput(diffResults)

  const checksResult = await octokit.rest.checks.listForRef({
    ...github.context.repo,
    ref: sha
  })
  const checksExists = checksResult.data.check_runs.find(
    (check) => check.name === CHECKS_NAME
  )

  if (checksExists) {
    await octokit.rest.checks.update({
      ...github.context.repo,
      check_run_id: checksExists.id,
      conclusion: conclusion,
      output: output
    })
    return checksExists.html_url!
  } else {
    const result = await octokit.rest.checks.create({
      ...github.context.repo,
      name: CHECKS_NAME,
      head_sha: sha,
      conclusion: conclusion,
      output: output
    })
    return result.data.html_url!
  }
}

export function getChecksOutput(diffResults: DiffResult[]): {
  title: string
  summary: string
  text?: string
} {
  const diffResultsMap = groupByProject(diffResults)
  return {
    title: CHECKS_NAME,
    summary: getCheckOutputSummary(diffResultsMap),
    text:
      diffResultsMap.size == 0 ? undefined : getCheckOutputText(diffResultsMap)
  }
}

function groupByProject(diffResults: DiffResult[]): Map<string, DiffResult[]> {
  return diffResults.reduce((acc, item) => {
    const key = item.project

    if (!acc.has(key)) {
      acc.set(key, [])
    }

    acc.get(key)!.push(item)

    return acc
  }, new Map<string, DiffResult[]>())
}

function getCheckOutputSummary(
  diffResultsMap: Map<string, DiffResult[]>
): string {
  const projects = Array.from(diffResultsMap.keys())

  let summary = ''
  if (projects.length == 0) {
    summary += '🆗 There are no differences in the Gradle dependencies.\n'
  } else {
    summary +=
      '⚠️ Detected that there are differences in the Gradle dependencies.\n'
    for (const project of projects) {
      summary += `- ${project}\n`
    }
  }
  return summary
}

function getCheckOutputText(diffResultsMap: Map<string, DiffResult[]>): string {
  const projects = Array.from(diffResultsMap.keys())

  let text = ''
  for (const project of projects) {
    text += `### ${project}\n`
    for (const diffResult of diffResultsMap.get(project)!) {
      text += `#### ${diffResult.configuration}\n`
      text += '```diff\n'
      text += `${diffResult.result}\n`
      text += '```\n'
    }
    text += '\n'
  }
  return text
}

export async function reportAsPrComment(
  octokitHelper: OctokitHelper,
  checksUrl: string,
  diffResults: DiffResult[]
): Promise<void> {
  const hasDiff = diffResults.length > 0

  const commentId = await findCommentByTag(octokitHelper, TAG)
  const existComment = commentId !== -1

  if (hasDiff) {
    const commentBody = `> [!Note]\n> Detected that there are [differences](${checksUrl}) in the Gradle dependencies.\n${TAG}`
    if (existComment) {
      // exist comment
      await octokitHelper.updateComment(commentId, commentBody)
    } else {
      await octokitHelper.createComment(
        github.context.issue.number,
        commentBody
      )
    }
  } else {
    if (existComment) {
      // exist comment
      await octokitHelper.deleteComment(commentId)
    }
  }
}

async function findCommentByTag(
  octokitHelper: OctokitHelper,
  tag: string
): Promise<number> {
  const comments = await octokitHelper.listComments(github.context.issue.number)
  const comment = comments.find((c) => c?.body?.includes(tag))
  return comment ? comment.id : -1
}

export async function reportAsPrBody(
  octokitHelper: OctokitHelper,
  checksUrl: string,
  diffResults: DiffResult[]
): Promise<void> {
  const hasDiff = diffResults.length > 0

  const response = await octokitHelper.getPullRequest(
    github.context.issue.number
  )
  const originalPrBody = response.data.body || ''
  let prBody = originalPrBody

  if (hasDiff) {
    let message = `${TAG}\n`
    message += `> [!Note]\n`
    message += `> Detected that there are [differences](${checksUrl}) in the Gradle dependencies.\n`
    message += `${TAG}`

    if (prBody.match(PR_BODY_TAG_PATTERN)) {
      prBody = prBody.replace(PR_BODY_TAG_PATTERN, message)
    } else {
      prBody += `\n${message}\n`
    }
  } else {
    prBody = prBody.replace(PR_BODY_TAG_PATTERN, '')
  }

  if (prBody !== originalPrBody) {
    await octokitHelper.updatePullRequest(github.context.issue.number, prBody)
  }
}

export async function reportAsLabel(
  octokitHelper: OctokitHelper,
  diffResults: DiffResult[],
  labelName: string
): Promise<void> {
  const hasDiff = diffResults.length > 0

  const labels = await octokitHelper.listLabelsOnIssue(
    github.context.issue.number
  )
  const exists = !!labels.find((it) => it.name === labelName)

  if (hasDiff) {
    if (!exists) {
      await octokitHelper.addLabels(github.context.issue.number, [labelName])
    }
  } else {
    if (exists) {
      await octokitHelper.removeLabel(github.context.issue.number, labelName)
    }
  }
}
