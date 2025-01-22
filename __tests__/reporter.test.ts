import {
  getChecksOutput,
  reportAsChecks,
  reportAsLabel,
  reportAsPrBody,
  reportAsPrComment
} from '../src/reporter'
import { DiffResult } from '../src/types'
import { jest } from '@jest/globals'
import { OctokitHelper } from '../src/octokitHelper'
import * as github from '@actions/github'

describe('reporter.ts', () => {
  const octokitHelper: jest.Mocked<OctokitHelper> = {
    getPullRequest: jest.fn(),
    updatePullRequest: jest.fn(),
    listComments: jest.fn(),
    createComment: jest.fn(),
    updateComment: jest.fn(),
    deleteComment: jest.fn(),
    listLabelsOnIssue: jest.fn(),
    addLabels: jest.fn(),
    removeLabel: jest.fn(),
    listChecksForRef: jest.fn(),
    createChecks: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.replaceProperty(github, 'context', {
      issue: { number: 1 },
      payload: { pull_request: { head: { sha: 'sha' } } }
    } as never)
    process.env.GITHUB_REPOSITORY = 'owner/repo'
  })

  describe('reportAsChecks', () => {
    it('checksExists', async () => {
      octokitHelper.listChecksForRef.mockResolvedValueOnce({
        data: {
          check_runs: [{ name: 'Report of gradle-dependency-diff-action' }]
        }
      } as never)

      const result = await reportAsChecks(octokitHelper, [])

      expect(result).toEqual([])
    })
    it('outputs.length === 1', async () => {
      octokitHelper.listChecksForRef.mockResolvedValueOnce({
        data: { check_runs: [] }
      } as never)
      octokitHelper.createChecks.mockResolvedValueOnce({
        data: { html_url: 'url' }
      } as never)

      const result = await reportAsChecks(octokitHelper, [])

      expect(result).toEqual(['url'])
      expect(octokitHelper.createChecks).toHaveBeenCalledWith(
        'Report of gradle-dependency-diff-action',
        'sha',
        'success',
        {
          title: 'Report of gradle-dependency-diff-action',
          summary: '🆗 There are no differences in the Gradle dependencies.\n'
        }
      )
    })
    it('outputs.length !== 1', async () => {
      const diffResults: DiffResult[] = [
        {
          project: ':A',
          configuration: 'configuration',
          result: 'A'
        },
        {
          project: ':B',
          configuration: 'configuration',
          result: 'B'.repeat(70000)
        }
      ]

      octokitHelper.listChecksForRef.mockResolvedValueOnce({
        data: { check_runs: [] }
      } as never)
      octokitHelper.createChecks.mockResolvedValueOnce({
        data: { html_url: 'url1' }
      } as never)
      octokitHelper.createChecks.mockResolvedValueOnce({
        data: { html_url: 'url2' }
      } as never)

      const result = await reportAsChecks(octokitHelper, diffResults)

      expect(result).toEqual(['url1', 'url2'])
      expect(octokitHelper.createChecks).toHaveBeenCalledWith(
        'Report of gradle-dependency-diff-action 1',
        'sha',
        'neutral',
        {
          title: 'Report of gradle-dependency-diff-action 1',
          summary: `⚠️ Detected that there are differences in the Gradle dependencies.
- :A - configuration
`,
          text: `### :A - configuration
\`\`\`diff
A
\`\`\`
`
        }
      )
      expect(octokitHelper.createChecks).toHaveBeenCalledWith(
        'Report of gradle-dependency-diff-action 2',
        'sha',
        'neutral',
        {
          title: 'Report of gradle-dependency-diff-action 2',
          summary: `⚠️ Detected that there are differences in the Gradle dependencies.
- :B - configuration
`,
          text: `### :B - configuration
\`\`\`diff
${'B'.repeat(65400)}
\`\`\`
※ Diff is too large, so truncated.
`
        }
      )
    })
  })

  describe('getChecksOutput', () => {
    it('empty', () => {
      const result = getChecksOutput([])
      expect(result).toEqual([
        {
          summary: '🆗 There are no differences in the Gradle dependencies.\n',
          text: undefined
        }
      ])
    })
    it('normal case 1', () => {
      const diffResults: DiffResult[] = [
        { project: ':A', configuration: 'configuration', result: 'resultA' }
      ]
      const result = getChecksOutput(diffResults)
      expect(result).toEqual([
        {
          summary: `⚠️ Detected that there are differences in the Gradle dependencies.
- :A - configuration
`,
          text: `### :A - configuration
\`\`\`diff
resultA
\`\`\`
`
        }
      ])
    })
    it('normal case 2', () => {
      const diffResults: DiffResult[] = [
        { project: ':A', configuration: 'configuration1', result: 'resultA1' },
        { project: ':A', configuration: 'configuration2', result: 'resultA2' },
        { project: ':B', configuration: 'configuration1', result: 'resultB1' }
      ]
      const result = getChecksOutput(diffResults)
      expect(result).toEqual([
        {
          summary: `⚠️ Detected that there are differences in the Gradle dependencies.
- :A - configuration1
- :A - configuration2
- :B - configuration1
`,
          text: `### :A - configuration1
\`\`\`diff
resultA1
\`\`\`
### :A - configuration2
\`\`\`diff
resultA2
\`\`\`
### :B - configuration1
\`\`\`diff
resultB1
\`\`\`
`
        }
      ])
    })
    it('overflow case 1', () => {
      const diffResults: DiffResult[] = [
        {
          project: ':A',
          configuration: 'configuration',
          result: 'A'.repeat(1000)
        },
        {
          project: ':B',
          configuration: 'configuration',
          result: 'B'.repeat(65000)
        },
        {
          project: ':C',
          configuration: 'configuration',
          result: 'C'.repeat(1000)
        }
      ]
      const result = getChecksOutput(diffResults)
      expect(result).toEqual([
        {
          summary: `⚠️ Detected that there are differences in the Gradle dependencies.
- :A - configuration
`,
          text: `### :A - configuration
\`\`\`diff
${'A'.repeat(1000)}
\`\`\`
`
        },
        {
          summary: `⚠️ Detected that there are differences in the Gradle dependencies.
- :B - configuration
`,
          text: `### :B - configuration
\`\`\`diff
${'B'.repeat(65000)}
\`\`\`
`
        },
        {
          summary: `⚠️ Detected that there are differences in the Gradle dependencies.
- :C - configuration
`,
          text: `### :C - configuration
\`\`\`diff
${'C'.repeat(1000)}
\`\`\`
`
        }
      ])
    })
    it('overflow case 2', () => {
      const diffResults: DiffResult[] = [
        {
          project: ':A',
          configuration: 'configuration',
          result: 'A'.repeat(300)
        },
        {
          project: ':B',
          configuration: 'configuration',
          result: 'B'.repeat(65000)
        },
        {
          project: ':C',
          configuration: 'configuration',
          result: 'C'.repeat(300)
        }
      ]
      const result = getChecksOutput(diffResults)
      expect(result).toEqual([
        {
          summary: `⚠️ Detected that there are differences in the Gradle dependencies.
- :A - configuration
- :B - configuration
`,
          text: `### :A - configuration
\`\`\`diff
${'A'.repeat(300)}
\`\`\`
### :B - configuration
\`\`\`diff
${'B'.repeat(65000)}
\`\`\`
`
        },
        {
          summary: `⚠️ Detected that there are differences in the Gradle dependencies.
- :C - configuration
`,
          text: `### :C - configuration
\`\`\`diff
${'C'.repeat(300)}
\`\`\`
`
        }
      ])
    })
    it('overflow case 3', () => {
      const diffResults: DiffResult[] = [
        {
          project: ':A',
          configuration: 'configuration',
          result: 'A'.repeat(70000)
        },
        {
          project: ':B',
          configuration: 'configuration',
          result: 'B'.repeat(70000)
        }
      ]
      const result = getChecksOutput(diffResults)
      expect(result).toEqual([
        {
          summary: `⚠️ Detected that there are differences in the Gradle dependencies.
- :A - configuration
`,
          text: `### :A - configuration
\`\`\`diff
${'A'.repeat(65400)}
\`\`\`
※ Diff is too large, so truncated.
`
        },
        {
          summary: `⚠️ Detected that there are differences in the Gradle dependencies.
- :B - configuration
`,
          text: `### :B - configuration
\`\`\`diff
${'B'.repeat(65400)}
\`\`\`
※ Diff is too large, so truncated.
`
        }
      ])
    })
  })

  describe('reportAsPrComment', () => {
    it('hasDiff && existComment', async () => {
      octokitHelper.listComments.mockResolvedValueOnce([
        { id: 10, body: '<!-- gradle-dependency-diff-action -->' } as never
      ])

      await reportAsPrComment(octokitHelper, ['url'], [{} as DiffResult])

      expect(octokitHelper.updateComment).toHaveBeenCalledWith(
        10,
        `> [!Note]
> Detected that there are differences in the Gradle dependencies.
> - url
<!-- gradle-dependency-diff-action -->`
      )
    })
    it('hasDiff && !existComment', async () => {
      octokitHelper.listComments.mockResolvedValueOnce([])

      await reportAsPrComment(octokitHelper, ['url'], [{} as DiffResult])

      expect(octokitHelper.createComment).toHaveBeenCalledWith(
        1,
        `> [!Note]
> Detected that there are differences in the Gradle dependencies.
> - url
<!-- gradle-dependency-diff-action -->`
      )
    })
    it('!hasDiff && existComment', async () => {
      octokitHelper.listComments.mockResolvedValueOnce([
        { id: 10, body: '<!-- gradle-dependency-diff-action -->' } as never
      ])

      await reportAsPrComment(octokitHelper, ['url'], [])

      expect(octokitHelper.deleteComment).toHaveBeenCalledWith(10)
    })
  })

  describe('reportAsPrBody', () => {
    it('hasDiff && prBodyMatch', async () => {
      const originalBody = `hogehoge

<!-- gradle-dependency-diff-action -->
hogehoge
<!-- gradle-dependency-diff-action -->`

      octokitHelper.getPullRequest.mockResolvedValueOnce({
        data: { body: originalBody }
      } as never)

      await reportAsPrBody(octokitHelper, ['url1', 'url2'], [{} as DiffResult])

      const updatedBody = `hogehoge

<!-- gradle-dependency-diff-action -->
> [!Note]
> Detected that there are differences in the Gradle dependencies.
> - url1
> - url2
<!-- gradle-dependency-diff-action -->`
      expect(octokitHelper.updatePullRequest).toHaveBeenCalledWith(
        1,
        updatedBody
      )
    })
    it('hasDiff && !prBodyMatch', async () => {
      const originalBody = 'hogehoge'

      octokitHelper.getPullRequest.mockResolvedValueOnce({
        data: { body: originalBody }
      } as never)

      await reportAsPrBody(octokitHelper, ['url'], [{} as DiffResult])

      const updatedBody = `hogehoge
<!-- gradle-dependency-diff-action -->
> [!Note]
> Detected that there are differences in the Gradle dependencies.
> - url
<!-- gradle-dependency-diff-action -->`
      expect(octokitHelper.updatePullRequest).toHaveBeenCalledWith(
        1,
        updatedBody
      )
    })
    it('!hasDiff && prBody !== originalPrBody', async () => {
      const originalBody = `hogehoge

<!-- gradle-dependency-diff-action -->
hogehoge
<!-- gradle-dependency-diff-action -->`

      octokitHelper.getPullRequest.mockResolvedValueOnce({
        data: { body: originalBody }
      } as never)

      await reportAsPrBody(octokitHelper, ['url'], [])

      const updatedBody = `hogehoge

`
      expect(octokitHelper.updatePullRequest).toHaveBeenCalledWith(
        1,
        updatedBody
      )
    })
    it('!hasDiff && prBody == originalPrBody', async () => {
      const originalBody = 'hogehoge'

      octokitHelper.getPullRequest.mockResolvedValueOnce({
        data: { body: originalBody }
      } as never)

      await reportAsPrBody(octokitHelper, ['url'], [])

      expect(octokitHelper.updatePullRequest).toHaveBeenCalledTimes(0)
    })
  })

  describe('reportAsLabel', () => {
    it('hasDiff && exists', async () => {
      octokitHelper.listLabelsOnIssue.mockResolvedValueOnce([
        { name: 'labelName' } as never
      ])

      await reportAsLabel(octokitHelper, [{} as DiffResult], 'labelName')

      expect(octokitHelper.addLabels).toHaveBeenCalledTimes(0)
    })
    it('hasDiff && !exists', async () => {
      octokitHelper.listLabelsOnIssue.mockResolvedValueOnce([])

      await reportAsLabel(octokitHelper, [{} as DiffResult], 'labelName')

      expect(octokitHelper.addLabels).toHaveBeenCalledWith(1, ['labelName'])
    })
    it('!hasDiff && exists', async () => {
      octokitHelper.listLabelsOnIssue.mockResolvedValueOnce([
        { name: 'labelName' } as never
      ])

      await reportAsLabel(octokitHelper, [], 'labelName')

      expect(octokitHelper.removeLabel).toHaveBeenCalledWith(1, 'labelName')
    })
    it('!hasDiff && !exists', async () => {
      octokitHelper.listLabelsOnIssue.mockResolvedValueOnce([])

      await reportAsLabel(octokitHelper, [], 'labelName')

      expect(octokitHelper.removeLabel).toHaveBeenCalledTimes(0)
    })
  })
})
