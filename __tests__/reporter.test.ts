import {
  getChecksOutput,
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
    removeLabel: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.replaceProperty(github, 'context', {
      issue: { number: 1 }
    } as never)
    process.env.GITHUB_REPOSITORY = 'owner/repo'
  })

  describe('getChecksOutput', () => {
    it('empty', () => {
      const result = getChecksOutput([])
      expect(result).toEqual({
        title: 'Report of gradle-dependency-diff-action',
        summary: '🆗 There are no differences in the Gradle dependencies.\n',
        text: undefined
      })
    })
    it('normal case', () => {
      const diffResults: DiffResult[] = [
        { project: ':A', configuration: 'configuration1', result: 'resultA1' },
        { project: ':A', configuration: 'configuration2', result: 'resultA2' },
        { project: ':B', configuration: 'configuration1', result: 'resultB1' }
      ]
      const result = getChecksOutput(diffResults)
      expect(result).toEqual({
        title: 'Report of gradle-dependency-diff-action',
        summary: `⚠️ Detected that there are differences in the Gradle dependencies.
- :A
- :B
`,
        text: `### :A
#### configuration1
\`\`\`diff
resultA1
\`\`\`
#### configuration2
\`\`\`diff
resultA2
\`\`\`

### :B
#### configuration1
\`\`\`diff
resultB1
\`\`\`

`
      })
    })
  })

  describe('reportAsPrComment', () => {
    it('hasDiff && existComment', async () => {
      octokitHelper.listComments.mockResolvedValueOnce([
        { id: 10, body: '<!-- gradle-dependency-diff-action -->' } as never
      ])

      await reportAsPrComment(octokitHelper, 'checksUrl', [{} as DiffResult])

      expect(octokitHelper.updateComment).toHaveBeenCalledWith(
        10,
        `> [!Note]
> Detected that there are [differences](checksUrl) in the Gradle dependencies.
<!-- gradle-dependency-diff-action -->`
      )
    })
    it('hasDiff && !existComment', async () => {
      octokitHelper.listComments.mockResolvedValueOnce([])

      await reportAsPrComment(octokitHelper, 'checksUrl', [{} as DiffResult])

      expect(octokitHelper.createComment).toHaveBeenCalledWith(
        1,
        `> [!Note]
> Detected that there are [differences](checksUrl) in the Gradle dependencies.
<!-- gradle-dependency-diff-action -->`
      )
    })
    it('!hasDiff && existComment', async () => {
      octokitHelper.listComments.mockResolvedValueOnce([
        { id: 10, body: '<!-- gradle-dependency-diff-action -->' } as never
      ])

      await reportAsPrComment(octokitHelper, 'checksUrl', [])

      expect(octokitHelper.deleteComment).toHaveBeenCalledWith(10)
    })
  })

  describe('reportAsPrBody', () => {
    it('hasDiff && prBodyMatch', async () => {
      const originalBody = `hogehoge

<!-- gradle-dependency-diff-action -->
hogehoge
<!-- gradle-dependency-diff-action -->
`

      octokitHelper.getPullRequest.mockResolvedValueOnce({
        data: { body: originalBody }
      } as never)

      await reportAsPrBody(octokitHelper, 'checksUrl', [{} as DiffResult])

      const updatedBody = `hogehoge

<!-- gradle-dependency-diff-action -->
> [!Note]
> Detected that there are [differences](checksUrl) in the Gradle dependencies.
<!-- gradle-dependency-diff-action -->
`
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

      await reportAsPrBody(octokitHelper, 'checksUrl', [{} as DiffResult])

      const updatedBody = `hogehoge
<!-- gradle-dependency-diff-action -->
> [!Note]
> Detected that there are [differences](checksUrl) in the Gradle dependencies.
<!-- gradle-dependency-diff-action -->
`
      expect(octokitHelper.updatePullRequest).toHaveBeenCalledWith(
        1,
        updatedBody
      )
    })
    it('!hasDiff && prBody !== originalPrBody', async () => {
      const originalBody = `hogehoge

<!-- gradle-dependency-diff-action -->
hogehoge
<!-- gradle-dependency-diff-action -->
`

      octokitHelper.getPullRequest.mockResolvedValueOnce({
        data: { body: originalBody }
      } as never)

      await reportAsPrBody(octokitHelper, 'checksUrl', [])

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

      await reportAsPrBody(octokitHelper, 'checksUrl', [])

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
