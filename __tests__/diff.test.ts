import {
  calculateDiffResults,
  downloadJar,
  getProjectFromFile,
  sortDiffResults
} from '../src/diff'
import path from 'path'
import { jest } from '@jest/globals'
import fs from 'fs'
import * as glob from '@actions/glob'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import { TempDirs } from '../src/types'

describe('diff.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('downloadJar', () => {
    const fetch = jest.spyOn(global, 'fetch')
    const writeFileSync = jest.spyOn(fs, 'writeFileSync')

    it('success', async () => {
      const version = 'v1.0.0'
      const tempDir = '/temp'
      const jarPath = path.join(tempDir, 'dependency-tree-diff.jar')

      const arrayBuffer = new ArrayBuffer(10)
      const res = {
        ok: true,
        arrayBuffer: () => Promise.resolve(arrayBuffer)
      }
      fetch.mockResolvedValueOnce(res as Response)

      writeFileSync.mockImplementationOnce(() => {})

      const result = await downloadJar(version, tempDir)

      expect(fetch).toHaveBeenCalledWith(
        `https://github.com/JakeWharton/dependency-tree-diff/releases/download/${version}/dependency-tree-diff.jar`
      )
      expect(writeFileSync).toHaveBeenCalledWith(
        jarPath,
        Buffer.from(arrayBuffer)
      )
      expect(result).toBe(jarPath)
    })
    it('fetch failed', async () => {
      const version = 'v1.0.0'
      const tempDir = '/temp'

      fetch.mockResolvedValueOnce({ ok: false } as Response)

      await expect(downloadJar(version, tempDir)).rejects.toThrow(
        'Failed to download dependency-tree-diff.jar'
      )
      expect(fetch).toHaveBeenCalledWith(
        `https://github.com/JakeWharton/dependency-tree-diff/releases/download/${version}/dependency-tree-diff.jar`
      )
    })
    it('fetch throw error', async () => {
      const version = 'v1.0.0'
      const tempDir = '/temp'

      fetch.mockRejectedValueOnce(new Error('Network Error'))

      await expect(downloadJar(version, tempDir)).rejects.toThrow(
        'Network Error'
      )
      expect(fetch).toHaveBeenCalledWith(
        `https://github.com/JakeWharton/dependency-tree-diff/releases/download/${version}/dependency-tree-diff.jar`
      )
    })
  })

  describe('calculateDiff', () => {
    const globCreate = jest.spyOn(glob, 'create')
    const existsSync = jest.spyOn(fs, 'existsSync')
    const readFileSync = jest.spyOn(fs, 'readFileSync')
    const getExecOutput = jest.spyOn(exec, 'getExecOutput')
    const writeFileSync = jest.spyOn(fs, 'writeFileSync')
    const mkdirP = jest.spyOn(io, 'mkdirP')

    it('success', async () => {
      const jarPath = '/path/to/jar'
      const configuration = 'configuration'
      const tempDirs: TempDirs = {
        root: '/temp',
        baseRepo: '/temp/base-repo',
        result: '/temp/result'
      }

      const globber = {
        glob: () =>
          Promise.resolve([
            '/temp/work/hoge/build/reports/project/dependencies.txt',
            '/temp/work/bar/build/reports/project/dependencies.txt',
            '/temp/work/fuga/build/reports/project/dependencies.txt'
          ])
      }
      globCreate.mockResolvedValueOnce(globber as glob.Globber)
      existsSync.mockReturnValueOnce(true)
      existsSync.mockReturnValueOnce(true)
      existsSync.mockReturnValueOnce(false)
      readFileSync.mockReturnValueOnce(`Project ':hoge'`)
      readFileSync.mockReturnValueOnce(`Project ':bar'`)
      getExecOutput.mockResolvedValueOnce({ stdout: '' } as exec.ExecOutput)
      getExecOutput.mockResolvedValueOnce({
        stdout: 'stdout'
      } as exec.ExecOutput)
      mkdirP.mockResolvedValueOnce()
      writeFileSync.mockReturnValueOnce()

      const result = await calculateDiffResults(
        jarPath,
        configuration,
        tempDirs
      )

      expect(globCreate).toHaveBeenCalledWith(
        '**/build/reports/project/dependencies.txt'
      )
      expect(result).toEqual([
        {
          project: ':bar',
          configuration: configuration,
          result: 'stdout'
        }
      ])
      expect(writeFileSync).toHaveBeenCalledWith(
        `/temp/result/bar/${configuration}.txt`,
        'stdout'
      )
    })
    it('empty', async () => {
      const jarPath = '/path/to/jar'
      const configuration = 'configuration'
      const tempDirs: TempDirs = {
        root: '/temp',
        baseRepo: '/temp/base-repo',
        result: '/temp/result'
      }

      const globber = {
        glob: () => Promise.resolve([] as string[])
      }
      globCreate.mockResolvedValueOnce(globber as glob.Globber)

      const result = await calculateDiffResults(
        jarPath,
        configuration,
        tempDirs
      )

      expect(globCreate).toHaveBeenCalledWith(
        '**/build/reports/project/dependencies.txt'
      )
      expect(result).toEqual([])
    })
  })

  describe('sortDiffResults', () => {
    it('sortDiffResults', () => {
      const result = sortDiffResults([
        { project: ':b', configuration: 'b', result: '' },
        { project: ':b', configuration: 'a', result: '' },
        { project: ':a', configuration: 'b', result: '' },
        { project: ':a', configuration: 'a', result: '' },
        { project: 'gradle-root-project', configuration: 'b', result: '' },
        { project: 'gradle-root-project', configuration: 'a', result: '' }
      ])
      expect(result).toEqual([
        { project: 'gradle-root-project', configuration: 'a', result: '' },
        { project: 'gradle-root-project', configuration: 'b', result: '' },
        { project: ':a', configuration: 'a', result: '' },
        { project: ':a', configuration: 'b', result: '' },
        { project: ':b', configuration: 'a', result: '' },
        { project: ':b', configuration: 'b', result: '' }
      ])
    })
  })

  describe('getProjectFromFile', () => {
    const readFileSync = jest.spyOn(fs, 'readFileSync')

    it('project', () => {
      readFileSync.mockReturnValueOnce(`Project ':hoge'`)
      const result = getProjectFromFile('filePath')
      expect(result).toEqual(':hoge')
    })
    it('root project', () => {
      readFileSync.mockReturnValueOnce(`Root project 'hoge'`)
      const result = getProjectFromFile('filePath')
      expect(result).toEqual('hoge')
    })
  })
})
