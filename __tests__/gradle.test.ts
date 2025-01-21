import {
  execDependenciesTask,
  execGradleProjects,
  filterGradleProjects,
  generateDependenciesFiles,
  getDependenciesTasks,
  getProjectFromTask,
  parseGradleProjects
} from '../src/gradle'
import { jest } from '@jest/globals'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import path from 'node:path'
import fs from 'fs'

describe('gradle.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateDependenciesFiles', () => {
    const getExecOutput = jest.spyOn(exec, 'getExecOutput')
    const mkdirP = jest.spyOn(io, 'mkdirP')
    const writeFileSync = jest.spyOn(fs, 'writeFileSync')

    it('test', async () => {
      getExecOutput.mockResolvedValueOnce({
        stdout: `+--- Project ':hoge'\n+--- Project ':fuga'`
      } as exec.ExecOutput)
      mkdirP.mockResolvedValue()
      getExecOutput.mockResolvedValue({
        exitCode: 0,
        stdout: 'stdout'
      } as exec.ExecOutput)
      writeFileSync.mockImplementation(() => {})

      await generateDependenciesFiles(
        {
          includeProjectRegex: '',
          excludeProjectRegex: '',
          includeRootProject: false,
          configurations: 'compileClasspath, runtimeClasspath'
        },
        '/temp'
      )

      expect(writeFileSync).toHaveBeenCalledWith(
        path.join('/temp', ':hoge', `compileClasspath.txt`),
        'stdout'
      )
      expect(writeFileSync).toHaveBeenCalledWith(
        path.join('/temp', ':hoge', `runtimeClasspath.txt`),
        'stdout'
      )
      expect(writeFileSync).toHaveBeenCalledWith(
        path.join('/temp', ':fuga', `compileClasspath.txt`),
        'stdout'
      )
      expect(writeFileSync).toHaveBeenCalledWith(
        path.join('/temp', ':fuga', `runtimeClasspath.txt`),
        'stdout'
      )
    })
  })

  describe('execGradleProjects', () => {
    const getExecOutput = jest.spyOn(exec, 'getExecOutput')

    it('test', async () => {
      getExecOutput.mockResolvedValueOnce({
        stdout: 'stdout'
      } as exec.ExecOutput)

      const result = await execGradleProjects('cwd')

      expect(result).toEqual('stdout')
      expect(getExecOutput).toHaveBeenCalledWith('./gradlew', ['projects'], {
        cwd: 'cwd',
        silent: true
      })
    })
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

  describe('execDependenciesTask', () => {
    const mkdirP = jest.spyOn(io, 'mkdirP')
    const getExecOutput = jest.spyOn(exec, 'getExecOutput')
    const writeFileSync = jest.spyOn(fs, 'writeFileSync')

    it('test', async () => {
      mkdirP.mockResolvedValueOnce()
      getExecOutput.mockResolvedValueOnce({
        stdout: 'stdout1',
        exitCode: 0
      } as exec.ExecOutput)
      getExecOutput.mockResolvedValueOnce({
        exitCode: 1
      } as exec.ExecOutput)
      writeFileSync.mockImplementation(() => {})

      await execDependenciesTask(
        ':hoge:dependencies',
        ['compileClasspath', 'runtimeClasspath'],
        '/temp'
      )

      expect(mkdirP).toHaveBeenCalledWith(path.join('/temp', ':hoge'))
      expect(getExecOutput).toHaveBeenCalledWith(
        './gradlew',
        [':hoge:dependencies', '--configuration', 'compileClasspath'],
        {
          ignoreReturnCode: true,
          silent: true
        }
      )
      expect(getExecOutput).toHaveBeenCalledWith(
        './gradlew',
        [':hoge:dependencies', '--configuration', 'runtimeClasspath'],
        {
          ignoreReturnCode: true,
          silent: true
        }
      )
      expect(writeFileSync).toHaveBeenCalledTimes(1)
      expect(writeFileSync).toHaveBeenCalledWith(
        path.join('/temp', ':hoge', `compileClasspath.txt`),
        'stdout1'
      )
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
