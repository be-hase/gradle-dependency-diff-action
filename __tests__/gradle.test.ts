import { jest } from '@jest/globals'
import * as exec from '@actions/exec'
import { generateDependenciesFiles } from '../src/gradle'

describe('gradle.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateDependenciesFiles', () => {
    const getExecOutput = jest.spyOn(exec, 'getExecOutput')

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
