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
    }
  }
}
