import * as github from '@actions/github'

export type OctokitHelper = ReturnType<typeof getOctokitHelper>
export type Octokit = ReturnType<typeof github.getOctokit>

export function getOctokitHelper(octokit: Octokit) {
  return {
    async getPullRequest(pullNumber: number) {
      return await octokit.rest.pulls.get({
        ...github.context.repo,
        pull_number: pullNumber
      })
    },

    async updatePullRequest(pullNumber: number, body: string) {
      return await octokit.rest.pulls.update({
        ...github.context.repo,
        pull_number: pullNumber,
        body
      })
    },

    async listComments(issueNumber: number) {
      return await octokit.paginate(octokit.rest.issues.listComments, {
        ...github.context.repo,
        issue_number: issueNumber,
        per_page: 100
      })
    },

    async createComment(issueNumber: number, body: string) {
      return await octokit.rest.issues.createComment({
        ...github.context.repo,
        issue_number: issueNumber,
        body: body
      })
    },

    async updateComment(commentId: number, body: string) {
      return await octokit.rest.issues.updateComment({
        ...github.context.repo,
        comment_id: commentId,
        body: body
      })
    },

    async deleteComment(commentId: number) {
      return await octokit.rest.issues.deleteComment({
        ...github.context.repo,
        comment_id: commentId
      })
    },

    async listLabelsOnIssue(issueNumber: number) {
      return await octokit.paginate(octokit.rest.issues.listLabelsOnIssue, {
        ...github.context.repo,
        issue_number: issueNumber,
        per_page: 100
      })
    },

    async addLabels(issueNumber: number, labels: string[]) {
      return await octokit.rest.issues.addLabels({
        ...github.context.repo,
        issue_number: issueNumber,
        labels
      })
    },

    async removeLabel(issueNumber: number, label: string) {
      return await octokit.rest.issues.removeLabel({
        ...github.context.repo,
        issue_number: issueNumber,
        name: label
      })
    },

    async listChecksForRef(ref: string) {
      return await octokit.rest.checks.listForRef({
        ...github.context.repo,
        ref
      })
    },

    async createChecks(
      name: string,
      headSha: string,
      conclusion: 'neutral' | 'success',
      output: {
        title: string
        summary: string
        text: string | undefined
      }
    ) {
      return await octokit.rest.checks.create({
        ...github.context.repo,
        name: name,
        head_sha: headSha,
        conclusion: conclusion,
        output: output
      })
    }
  }
}
