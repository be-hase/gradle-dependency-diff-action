import { jest } from '@jest/globals'
import type * as exec from '@actions/exec'

const getExecOutput = jest.fn<typeof exec.getExecOutput>()

jest.unstable_mockModule('@actions/exec', () => ({
  getExecOutput
}))

const { generateDependenciesFiles } = await import('../src/gradle.js')

describe('gradle.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateDependenciesFiles', () => {
    it('test', async () => {
      getExecOutput.mockResolvedValueOnce({} as exec.ExecOutput)
      await generateDependenciesFiles('configuration', 'cwd')
      expect(getExecOutput).toHaveBeenCalledWith(
        './gradlew',
        ['clean', 'dependencyReport', '--configuration', 'configuration'],
        { cwd: 'cwd' }
      )
    })
  })
})
