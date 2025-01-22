import { cloneBaseRepository, createTempDirs, getGitUrl } from '../src/main'
import { expect, jest } from '@jest/globals'
import * as exec from '@actions/exec'
import * as github from '@actions/github'
import * as utils from '../src/utils.js'
import * as io from '@actions/io'

describe('main.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createTempDirs', () => {
    const createTempDirectory = jest.spyOn(utils, 'createTempDirectory')
    const mkdirP = jest.spyOn(io, 'mkdirP')

    it('test', async () => {
      const tempDir = '/temp'

      createTempDirectory.mockResolvedValueOnce(tempDir)
      mkdirP.mockResolvedValue()

      const result = await createTempDirs()

      expect(result).toEqual({
        root: '/temp',
        baseRepo: '/temp/base-repo',
        baseDependencies: '/temp/base-dependencies',
        currentDependencies: '/temp/current-dependencies'
      })
      expect(mkdirP).toHaveBeenCalledWith('/temp/base-repo')
      expect(mkdirP).toHaveBeenCalledWith('/temp/base-dependencies')
      expect(mkdirP).toHaveBeenCalledWith('/temp/current-dependencies')
    })
  })

  describe('getGitUrl', () => {
    beforeEach(() => {
      process.env.GITHUB_REPOSITORY = 'owner/repo'
    })
    it('personal token', () => {
      const actual = getGitUrl('ghp_token')
      expect(actual).toEqual('https://ghp_token@github.com/owner/repo')
    })
    it('not personal token', () => {
      const actual = getGitUrl('token')
      expect(actual).toEqual(
        'https://x-access-token:token@github.com/owner/repo'
      )
    })
  })

  describe('cloneBaseRepository', () => {
    const mockExec = jest.spyOn(exec, 'exec')

    it('test', async () => {
      const gitUrl = 'gitUrl'
      const baseRepoDir = 'baseRepoDir'

      mockExec.mockResolvedValue(0)
      jest.replaceProperty(github, 'context', {
        payload: { pull_request: { base: { ref: 'main' } } }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      await cloneBaseRepository('gitUrl', 'baseRepoDir')

      expect(mockExec).toHaveBeenCalledWith('git', [
        'clone',
        '--depth',
        '1',
        '-b',
        'main',
        gitUrl,
        baseRepoDir
      ])
    })
  })
})
