import * as github from '@actions/github'
import { DiffResult } from './types.js'
import { OctokitHelper } from './octokitHelper.js'
import * as artifact from '@actions/artifact'
import * as glob from '@actions/glob'
import path from 'path'

const CHECKS_NAME = 'Report of gradle-dependency-diff-action'
const TAG = '<!-- gradle-dependency-diff-action -->'
const PR_BODY_TAG_PATTERN = new RegExp(`${TAG}[\\s\\S]*${TAG}`)

export async function reportToChecks(
  octokitHelper: OctokitHelper,
  diffResults: DiffResult[]
): Promise<string[]> {
  const sha = github.context.payload.pull_request!.head.sha
  const conclusion = diffResults.length == 0 ? 'success' : 'neutral'
  const outputs = getChecksOutput(diffResults)

  const checksResult = await octokitHelper.listChecksForRef(sha)
  const checksExists = checksResult.data.check_runs.find((check) =>
    check.name.includes(CHECKS_NAME)
  )
  if (checksExists) {
    return []
  }

  if (outputs.length === 1) {
    const res = await octokitHelper.createChecks(CHECKS_NAME, sha, conclusion, {
      title: CHECKS_NAME,
      summary: outputs[0].summary,
      text: outputs[0].text
    })
    return [res.data.html_url!]
  } else {
    const result = []
    for (const [i, output] of outputs.entries()) {
      const index = i + 1
      const res = await octokitHelper.createChecks(
        `${CHECKS_NAME} ${index}`,
        sha,
        conclusion,
        {
          title: `${CHECKS_NAME} ${index}`,
          summary: output.summary,
          text: output.text
        }
      )
      result.push(res.data.html_url!)
    }
    return result
  }
}

export function getChecksOutput(diffResults: DiffResult[]): {
  summary: string
  text: string | undefined
}[] {
  if (diffResults.length === 0) {
    return [
      {
        summary: '🆗 There are no differences in the Gradle dependencies.\n',
        text: undefined
      }
    ]
  }

  const result: { summary: string; text: string }[] = []
  let currentSummary: string[] = []
  let currentText: string[] = []

  function tryFlush() {
    if (currentSummary.length !== 0) {
      result.push({
        summary:
          'Detected that there are differences in the Gradle dependencies.\n' +
          currentSummary.join('\n') +
          '\n',
        text: currentText.join('\n') + '\n'
      })
      currentSummary = []
      currentText = []
    }
  }

  for (const diffResult of diffResults) {
    const summary = `- ${diffResult.project} - ${diffResult.configuration}`
    let text = `### ${diffResult.project} - ${diffResult.configuration}\n`
    text += '```diff\n'
    text += `${diffResult.result}\n`
    text += '```'

    if (currentText.join('\n').length + text.length < 65535) {
      currentSummary.push(summary)
      currentText.push(text)
    } else {
      tryFlush()
      if (text.length >= 65535) {
        text = `### ${diffResult.project} - ${diffResult.configuration}\n`
        text += '```diff\n'
        text += `${diffResult.result.substring(0, 65400)}\n`
        text += '```\n'
        text += '※ Diff is too large, so truncated.'
      }
      currentSummary.push(summary)
      currentText.push(text)
    }
  }

  tryFlush()

  return result
}

export async function reportToCustomEndpoint(
  endpointUrl: string,
  headers: string[],
  diffResults: DiffResult[]
) {
  if (diffResults.length === 0) {
    return []
  }

  const markdownText = diffResults
    .map((diffResult) => {
      let text = `### ${diffResult.project} - ${diffResult.configuration}\n`
      text += '```diff\n'
      text += `${diffResult.result}\n`
      text += '```'
      return text
    })
    .join('\n')

  const headersRecords = headers.reduce<Record<string, string>>((obj, item) => {
    const [key, value] = item.split(':')
    obj[key] = value
    return obj
  }, {})

  const res = await fetch(endpointUrl, {
    method: 'post',
    headers: {
      'content-type': 'application/json',
      ...headersRecords
    },
    body: JSON.stringify({ body: markdownText })
  })

  const json = (await res.json()) as { url: string }
  return [json.url]
}

export async function reportToPrComment(
  octokitHelper: OctokitHelper,
  urls: string[],
  diffResults: DiffResult[]
): Promise<void> {
  const hasDiff = diffResults.length > 0

  const commentId = await findCommentByTag(octokitHelper, TAG)
  const existComment = commentId !== -1

  if (hasDiff) {
    let commentBody = `> [!Note]\n`
    commentBody += `> Detected that there are differences in the Gradle dependencies.\n`
    for (const url of urls) {
      commentBody += `> - ${url}\n`
    }
    commentBody += `${TAG}`

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

export async function reportToPrBody(
  octokitHelper: OctokitHelper,
  urls: string[],
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
    message += `> Detected that there are differences in the Gradle dependencies.\n`
    for (const url of urls) {
      message += `> - ${url}\n`
    }
    message += `${TAG}`

    if (prBody.match(PR_BODY_TAG_PATTERN)) {
      prBody = prBody.replace(PR_BODY_TAG_PATTERN, message)
    } else {
      prBody += `\n${message}`
    }
  } else {
    prBody = prBody.replace(PR_BODY_TAG_PATTERN, '')
  }

  if (prBody !== originalPrBody) {
    await octokitHelper.updatePullRequest(github.context.issue.number, prBody)
  }
}

export async function reportToLabel(
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

export async function reportToArtifact(resultDir: string) {
  const globber = await glob.create(path.join(resultDir, '**', '*.txt'))
  const files = await globber.glob()

  const artifactClient = artifact.create()
  await artifactClient.uploadArtifact(
    'gradle-dependency-diff-action-result',
    files,
    resultDir
  )
}
