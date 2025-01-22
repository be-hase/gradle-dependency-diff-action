import {
  calculateDiff,
  downloadJar,
  getConfigurationFromFilePath,
  getOldFilePath,
  getProjectFromFilePath
} from '../src/diff'
import path from 'path'
import { jest } from '@jest/globals'
import fs from 'fs'
import { TempDirs } from '../src/types'
import * as glob from '@actions/glob'
import * as exec from '@actions/exec'

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
    const getExecOutput = jest.spyOn(exec, 'getExecOutput')

    it('success', async () => {
      const jarPath = '/path/to/jar'
      const tempDirs: TempDirs = {
        root: '/temp',
        baseRepo: '/temp/base-repo',
        baseDependencies: '/temp/base-dependencies',
        currentDependencies: '/temp/current-dependencies'
      }

      const globber = {
        glob: () =>
          Promise.resolve([
            '/temp/current-dependencies/hoge/configuration.txt',
            '/temp/current-dependencies/bar/configuration.txt'
          ])
      }
      globCreate.mockResolvedValueOnce(globber as glob.Globber)
      existsSync.mockReturnValue(true)
      getExecOutput.mockResolvedValueOnce({ stdout: '' } as exec.ExecOutput)
      getExecOutput.mockResolvedValueOnce({
        stdout: 'stdout'
      } as exec.ExecOutput)

      const result = await calculateDiff(jarPath, tempDirs)

      expect(globCreate).toHaveBeenCalledWith(
        '/temp/current-dependencies/**/*.txt'
      )
      expect(result).toEqual([
        {
          project: 'bar',
          configuration: 'configuration',
          result: 'stdout'
        }
      ])
    })
    it('empty', async () => {
      const jarPath = '/path/to/jar'
      const tempDirs: TempDirs = {
        root: '/temp',
        baseRepo: '/temp/base-repo',
        baseDependencies: '/temp/base-dependencies',
        currentDependencies: '/temp/current-dependencies'
      }

      const globber = {
        glob: () => Promise.resolve([] as string[])
      }
      globCreate.mockResolvedValueOnce(globber as glob.Globber)

      const result = await calculateDiff(jarPath, tempDirs)

      expect(globCreate).toHaveBeenCalledWith(
        '/temp/current-dependencies/**/*.txt'
      )
      expect(result).toEqual([])
    })
  })

  describe('getOldFilePath', () => {
    it('getOldFilePath', () => {
      const result = getOldFilePath(
        path.join('hoge', 'project', 'configuration.txt'),
        'bar'
      )
      expect(result).toEqual(path.join('bar', 'project', 'configuration.txt'))
    })
  })

  describe('getProjectFromFilePath', () => {
    it('getProjectFromFilePath', () => {
      const result = getProjectFromFilePath(
        path.join('hoge', 'project', 'configuration.txt')
      )
      expect(result).toEqual('project')
    })
  })

  describe('getConfigurationFromFilePath', () => {
    it('getConfigurationFromFilePath', () => {
      const result = getConfigurationFromFilePath(
        path.join('hoge', 'project', 'configuration.txt')
      )
      expect(result).toEqual('configuration')
    })
  })
})
