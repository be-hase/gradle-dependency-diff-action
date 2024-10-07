import {
  getConfigurationFromFilePath,
  getOldFilePath,
  getProjectFromFilePath
} from '../src/diff'
import path from 'path'

describe('diff.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getOldFilePath', () => {
    it('getOldFilePath', () => {
      const actual = getOldFilePath(
        path.join('hoge', 'project', 'configuration.txt'),
        'bar'
      )
      expect(actual).toEqual(path.join('bar', 'project', 'configuration.txt'))
    })
  })

  describe('getProjectFromFilePath', () => {
    it('getProjectFromFilePath', () => {
      const actual = getProjectFromFilePath(
        path.join('hoge', 'project', 'configuration.txt')
      )
      expect(actual).toEqual('project')
    })
  })

  describe('getConfigurationFromFilePath', () => {
    it('getConfigurationFromFilePath', () => {
      const actual = getConfigurationFromFilePath(
        path.join('hoge', 'project', 'configuration.txt')
      )
      expect(actual).toEqual('configuration')
    })
  })
})
