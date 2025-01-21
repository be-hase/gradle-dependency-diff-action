import {
  filterGradleProjects,
  getDependenciesTasks,
  getProjectFromTask,
  parseGradleProjects
} from '../src/gradle'
import { jest } from '@jest/globals'

describe('gradle.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('parseGradleProjects', () => {
    it('success', () => {
      const text = `
> Task :projects

Projects:

------------------------------------------------------------
Root project 'root'
------------------------------------------------------------

Root project 'root'
+--- Project ':hoge'
+--- Project ':fuga'
|    +--- Project ':fuga:dog' - hoge's
|    +--- Project ':fuga:cat'
`
      const result = parseGradleProjects(text)
      expect(result).toEqual([':hoge', ':fuga', ':fuga:dog', ':fuga:cat'])
    })
    it('empty', () => {
      const result = parseGradleProjects('')
      expect(result).toEqual([])
    })
  })

  describe('filterGradleProjects', () => {
    it('includeProjectRegex', () => {
      const result = filterGradleProjects(
        [':hoge', ':fuga', ':fuga:dog', ':fuga:cat'],
        'fuga',
        ''
      )
      expect(result).toEqual([':fuga', ':fuga:dog', ':fuga:cat'])
    })
    it('excludeProjectRegex', () => {
      const result = filterGradleProjects(
        [':hoge', ':fuga', ':fuga:dog', ':fuga:cat'],
        '',
        'fuga'
      )
      expect(result).toEqual([':hoge'])
    })
    it('both includeProjectRegex and excludeProjectRegex', () => {
      const result = filterGradleProjects(
        [':hoge', ':fuga', ':fuga:dog', ':fuga:cat'],
        'fuga',
        'cat'
      )
      expect(result).toEqual([':fuga', ':fuga:dog'])
    })
    it('no filter', () => {
      const result = filterGradleProjects(
        [':hoge', ':fuga', ':fuga:dog', ':fuga:cat'],
        '',
        ''
      )
      expect(result).toEqual([':hoge', ':fuga', ':fuga:dog', ':fuga:cat'])
    })
  })

  describe('getDependenciesTasks', () => {
    it('includeRootProject true', () => {
      const result = getDependenciesTasks([':hoge', ':fuga'], true)
      expect(result).toEqual([
        'dependencies',
        ':hoge:dependencies',
        ':fuga:dependencies'
      ])
    })
    it('includeRootProject false', () => {
      const result = getDependenciesTasks([':hoge', ':fuga'], false)
      expect(result).toEqual([':hoge:dependencies', ':fuga:dependencies'])
    })
  })

  describe('getProjectFromTask', () => {
    it('root', () => {
      const result = getProjectFromTask('dependencies')
      expect(result).toEqual('root')
    })
    it('non root', () => {
      const result = getProjectFromTask(':hoge:dependencies')
      expect(result).toEqual(':hoge')
    })
  })
})
