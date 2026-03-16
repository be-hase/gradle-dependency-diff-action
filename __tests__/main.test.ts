import {
  calculateDiffResults,
  cloneBaseRepository,
  createTempDirs,
  getGitUrl
} from '../src/main'
import { expect, jest } from '@jest/globals'
import * as exec from '@actions/exec'
import * as github from '@actions/github'
import * as utils from '../src/utils.js'
import * as io from '@actions/io'
import * as gradle from '../src/gradle.js'
import * as diff from '../src/diff.js'
import { TempDirs } from '../src/types'

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
        result: '/temp/result'
      })
      expect(mkdirP).toHaveBeenCalledWith('/temp/base-repo')
      expect(mkdirP).toHaveBeenCalledWith('/temp/result')
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
      } as never)

      await cloneBaseRepository('gitUrl', 'baseRepoDir')

      expect(mockExec).toHaveBeenCalledWith('git', [
        'clone',
        '--depth',
        '1',
        '--recurse-submodules',
        '--shallow-submodules',
        '-b',
        'main',
        gitUrl,
        baseRepoDir
      ])
    })
  })

  describe('calculateDiffResults', () => {
    const mockGenerateDependenciesFiles = jest.spyOn(
      gradle,
      'generateDependenciesFiles'
    )
    const mockCalculateDiffResults = jest.spyOn(diff, 'calculateDiffResults')

    it('test', async () => {
      const tempDirs: TempDirs = {
        root: '/temp',
        baseRepo: '/temp/base-repo',
        result: '/temp/result'
      }

      mockGenerateDependenciesFiles.mockResolvedValue()
      mockCalculateDiffResults.mockResolvedValueOnce([
        {
          project: 'p1',
          configuration: 'c1',
          result: 'r1'
        },
        {
          project: 'p2',
          configuration: 'c1',
          result: 'r2'
        }
      ])
      mockCalculateDiffResults.mockResolvedValueOnce([
        {
          project: 'p1',
          configuration: 'c2',
          result: 'r3'
        }
      ])

      const result = await calculateDiffResults(
        'jarPath',
        ['c1', 'c2'],
        tempDirs
      )
      expect(result).toEqual([
        {
          project: 'p1',
          configuration: 'c1',
          result: 'r1'
        },
        {
          project: 'p1',
          configuration: 'c2',
          result: 'r3'
        },
        {
          project: 'p2',
          configuration: 'c1',
          result: 'r2'
        }
      ])
    })
  })
})
