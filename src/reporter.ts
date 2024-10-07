import { GitHub } from '@actions/github/lib/utils'
import * as github from '@actions/github'
import { DiffResult } from './types'

const CHECKS_NAME = 'Report of gradle-dependency-diff-action'
const TAG = '<!-- gradle-dependency-diff-action -->'

export async function reportAsChecks(
  octokit: InstanceType<typeof GitHub>,
  diffResults: DiffResult[]
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const sha = github.context.payload.pull_request!.head.sha
  const conclusion = diffResults.length == 0 ? 'success' : 'neutral'
  const output = getChecksOutput(diffResults)

  const checksResult = await octokit.rest.checks.listForRef({
    ...github.context.repo,
    ref: sha
  })
  const checksExists = checksResult.data.check_runs.find(
    check => check.name === CHECKS_NAME
  )

  if (checksExists) {
    await octokit.rest.checks.update({
      ...github.context.repo,
      check_run_id: checksExists.id,
      conclusion: conclusion,
      output: output
    })
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return checksExists.html_url!
  } else {
    const result = await octokit.rest.checks.create({
      ...github.context.repo,
      name: CHECKS_NAME,
      head_sha: sha,
      conclusion: conclusion,
      output: output
    })
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
  octokit: InstanceType<typeof GitHub>,
  checksUrl: string,
  diffResults: DiffResult[]
): Promise<void> {
  const hasDiff = diffResults.length > 0

  const commentId = await findCommentByTag(octokit, TAG)

  if (hasDiff) {
    const commentBody = `> [!Note]\n> Detected that there are [differences](${checksUrl}) in the Gradle dependencies.\n${TAG}`
    if (commentId !== -1) {
      // exist comment
      await octokit.rest.issues.updateComment({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        comment_id: commentId,
        body: commentBody
      })
    } else {
      await octokit.rest.issues.createComment({
        ...github.context.repo,
        issue_number: github.context.issue.number,
        body: commentBody
      })
    }
  } else {
    if (commentId !== -1) {
      // exist comment
      await octokit.rest.issues.deleteComment({
        ...github.context.repo,
        comment_id: commentId
      })
    }
  }
}

export async function findCommentByTag(
  octokit: InstanceType<typeof GitHub>,
  tag: string
): Promise<number> {
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    ...github.context.repo,
    issue_number: github.context.issue.number,
    per_page: 100
  })
  const comment = comments.find(c => c?.body?.includes(tag))
  return comment ? comment.id : -1
}

export async function reportAsPrBody(
  octokit: InstanceType<typeof GitHub>,
  checksUrl: string,
  diffResults: DiffResult[]
): Promise<void> {
  const hasDiff = diffResults.length > 0
  const tagPattern = new RegExp(`${TAG}[\\s\\S]*${TAG}`)

  const response = await octokit.rest.pulls.get({
    ...github.context.repo,
    pull_number: github.context.issue.number
  })
  const originalPrBody = response.data.body || ''
  let prBody = originalPrBody

  if (hasDiff) {
    let message = `${TAG}\n`
    message += `> [!Note]\n`
    message += `> Detected that there are [differences](${checksUrl}) in the Gradle dependencies.\n`
    message += `${TAG}`

    if (prBody.match(tagPattern)) {
      prBody = prBody.replace(tagPattern, message)
    } else {
      prBody += `\n${message}\n`
    }
  } else {
    prBody = prBody.replace(tagPattern, '')
  }

  if (prBody !== originalPrBody) {
    await octokit.rest.pulls.update({
      ...github.context.repo,
      pull_number: github.context.issue.number,
      body: prBody
    })
  }
}

export async function reportAsLabel(
  octokit: InstanceType<typeof GitHub>,
  diffResults: DiffResult[],
  labelName: string
): Promise<void> {
  const hasDiff = diffResults.length > 0

  const labels = await octokit.paginate(octokit.rest.issues.listLabelsOnIssue, {
    ...github.context.repo,
    issue_number: github.context.issue.number,
    per_page: 100
  })
  const exists = !!labels.find(it => it.name === labelName)

  if (hasDiff) {
    if (!exists) {
      await octokit.rest.issues.addLabels({
        ...github.context.repo,
        issue_number: github.context.issue.number,
        labels: [labelName]
      })
    }
  } else {
    if (exists) {
      await octokit.rest.issues.removeLabel({
        ...github.context.repo,
        issue_number: github.context.issue.number,
        name: labelName
      })
    }
  }
}
