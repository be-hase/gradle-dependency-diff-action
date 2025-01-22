import { downloadJar, sortDiffResults } from '../src/diff'
import path from 'path'
import { jest } from '@jest/globals'
import fs from 'fs'

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
})
