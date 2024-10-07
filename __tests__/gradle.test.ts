/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import {
  filterGradleProjects,
  getDependenciesTasks,
  getProject,
  parseGradleProjects
} from '../src/gradle'

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
      const actual = parseGradleProjects(text)
      expect(actual).toEqual([':hoge', ':fuga', ':fuga:dog', ':fuga:cat'])
    })
    it('empty', () => {
      const actual = parseGradleProjects('')
      expect(actual).toEqual([])
    })
  })

  describe('filterGradleProjects', () => {
    it('includeProjectRegex', () => {
      const actual = filterGradleProjects(
        [':hoge', ':fuga', ':fuga:dog', ':fuga:cat'],
        'fuga',
        ''
      )
      expect(actual).toEqual([':fuga', ':fuga:dog', ':fuga:cat'])
    })
    it('excludeProjectRegex', () => {
      const actual = filterGradleProjects(
        [':hoge', ':fuga', ':fuga:dog', ':fuga:cat'],
        '',
        'fuga'
      )
      expect(actual).toEqual([':hoge'])
    })
    it('both includeProjectRegex and excludeProjectRegex', () => {
      const actual = filterGradleProjects(
        [':hoge', ':fuga', ':fuga:dog', ':fuga:cat'],
        'fuga',
        'cat'
      )
      expect(actual).toEqual([':fuga', ':fuga:dog'])
    })
    it('no filter', () => {
      const actual = filterGradleProjects(
        [':hoge', ':fuga', ':fuga:dog', ':fuga:cat'],
        '',
        ''
      )
      expect(actual).toEqual([':hoge', ':fuga', ':fuga:dog', ':fuga:cat'])
    })
  })

  describe('getDependenciesTasks', () => {
    it('includeRootProject true', () => {
      const actual = getDependenciesTasks([':hoge', ':fuga'], true)
      expect(actual).toEqual([
        'dependencies',
        ':hoge:dependencies',
        ':fuga:dependencies'
      ])
    })
    it('includeRootProject false', () => {
      const actual = getDependenciesTasks([':hoge', ':fuga'], false)
      expect(actual).toEqual([':hoge:dependencies', ':fuga:dependencies'])
    })
  })

  describe('getProject', () => {
    it('root', () => {
      const actual = getProject('dependencies')
      expect(actual).toEqual('root')
    })
    it('non root', () => {
      const actual = getProject(':hoge:dependencies')
      expect(actual).toEqual(':hoge')
    })
  })
})
