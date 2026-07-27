import { expect, jest } from '@jest/globals'
import * as github from '@actions/github'
import type * as exec from '@actions/exec'
import type * as io from '@actions/io'
import type * as utils from '../src/utils.js'
import type * as gradle from '../src/gradle.js'
import { TempDirs } from '../src/types.js'

const mockExec = jest.fn<typeof exec.exec>()
const mkdirP = jest.fn<typeof io.mkdirP>()
const createTempDirectory = jest.fn<typeof utils.createTempDirectory>()
const mockGenerateDependenciesFiles =
  jest.fn<typeof gradle.generateDependenciesFiles>()

const actualUtils = await import('../src/utils.js')
const actualDiff = await import('../src/diff.js')
const mockCalculateDiffResults =
  jest.fn<typeof actualDiff.calculateDiffResults>()

jest.unstable_mockModule('@actions/exec', () => ({
  exec: mockExec,
  getExecOutput: jest.fn()
}))
jest.unstable_mockModule('@actions/io', () => ({
  mkdirP
}))
jest.unstable_mockModule('../src/utils.js', () => ({
  ...actualUtils,
  createTempDirectory
}))
jest.unstable_mockModule('../src/gradle.js', () => ({
  generateDependenciesFiles: mockGenerateDependenciesFiles
}))
jest.unstable_mockModule('../src/diff.js', () => ({
  ...actualDiff,
  calculateDiffResults: mockCalculateDiffResults
}))

const { calculateDiffResults, cloneBaseRepository, createTempDirs, getGitUrl } =
  await import('../src/main.js')

describe('main.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createTempDirs', () => {
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
    it('test', async () => {
      const gitUrl =
        'https://x-access-token:token@github.com/example-org/example-repo'
      const baseRepoDir = 'baseRepoDir'

      mockExec.mockResolvedValue(0)
      github.context.payload = {
        pull_request: { number: 1, base: { ref: 'main' } }
      }

      await cloneBaseRepository(gitUrl, baseRepoDir)

      expect(mockExec).toHaveBeenCalledWith('git', [
        '-c',
        'url.https://x-access-token:token@github.com/.insteadOf=git@github.com:',
        '-c',
        'url.https://x-access-token:token@github.com/.insteadOf=ssh://git@github.com/',
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
