import { getChecksOutput } from '../src/reporter'
import { DiffResult } from '../src/types'

describe('reporter.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getChecksOutput', () => {
    it('empty', () => {
      const actual = getChecksOutput([])
      expect(actual).toEqual({
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
      const actual = getChecksOutput(diffResults)
      expect(actual).toEqual({
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
})
