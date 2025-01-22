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
      const projects = [':hoge', ':bar']
      const configurations = ['compileClasspath', 'runtimeClasspath']

      getExecOutput.mockResolvedValueOnce({
        stdout: `+--- Project ':hoge'\n+--- Project ':bar'`
      } as exec.ExecOutput)
      mkdirP.mockResolvedValue()
      getExecOutput.mockResolvedValue({
        exitCode: 0,
        stdout: 'stdout'
      } as exec.ExecOutput)
      writeFileSync.mockReturnValue()

      await generateDependenciesFiles(
        {
          includeProjectRegex: '',
          excludeProjectRegex: '',
          includeRootProject: false,
          configurations: configurations.join(', ')
        },
        '/temp'
      )

      projects.forEach((project) => {
        configurations.forEach((configuration) => {
          expect(writeFileSync).toHaveBeenCalledWith(
            path.join('/temp', project, `${configuration}.txt`),
            'stdout'
          )
        })
      })
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
+--- Project ':bar'
|    +--- Project ':bar:dog' - hoge's
|    +--- Project ':bar:cat'
`
      const result = parseGradleProjects(text)
      expect(result).toEqual([':hoge', ':bar', ':bar:dog', ':bar:cat'])
    })
    it('empty', () => {
      const result = parseGradleProjects('')
      expect(result).toEqual([])
    })
  })

  describe('filterGradleProjects', () => {
    it('includeProjectRegex', () => {
      const result = filterGradleProjects(
        [':hoge', ':bar', ':bar:dog', ':bar:cat'],
        'bar',
        ''
      )
      expect(result).toEqual([':bar', ':bar:dog', ':bar:cat'])
    })
    it('excludeProjectRegex', () => {
      const result = filterGradleProjects(
        [':hoge', ':bar', ':bar:dog', ':bar:cat'],
        '',
        'bar'
      )
      expect(result).toEqual([':hoge'])
    })
    it('both includeProjectRegex and excludeProjectRegex', () => {
      const result = filterGradleProjects(
        [':hoge', ':bar', ':bar:dog', ':bar:cat'],
        'bar',
        'cat'
      )
      expect(result).toEqual([':bar', ':bar:dog'])
    })
    it('no filter', () => {
      const result = filterGradleProjects(
        [':hoge', ':bar', ':bar:dog', ':bar:cat'],
        '',
        ''
      )
      expect(result).toEqual([':hoge', ':bar', ':bar:dog', ':bar:cat'])
    })
  })

  describe('getDependenciesTasks', () => {
    it('includeRootProject true', () => {
      const result = getDependenciesTasks([':hoge', ':bar'], true)
      expect(result).toEqual([
        'dependencies',
        ':hoge:dependencies',
        ':bar:dependencies'
      ])
    })
    it('includeRootProject false', () => {
      const result = getDependenciesTasks([':hoge', ':bar'], false)
      expect(result).toEqual([':hoge:dependencies', ':bar:dependencies'])
    })
  })

  describe('execDependenciesTask', () => {
    const mkdirP = jest.spyOn(io, 'mkdirP')
    const getExecOutput = jest.spyOn(exec, 'getExecOutput')
    const writeFileSync = jest.spyOn(fs, 'writeFileSync')

    it('test', async () => {
      const configurations = ['compileClasspath', 'runtimeClasspath']
      const outDir = '/temp'
      const project = ':hoge'

      mkdirP.mockResolvedValueOnce()
      getExecOutput.mockResolvedValueOnce({
        stdout: 'stdout1',
        exitCode: 0
      } as exec.ExecOutput)
      getExecOutput.mockResolvedValueOnce({
        exitCode: 1
      } as exec.ExecOutput)
      writeFileSync.mockReturnValue()

      await execDependenciesTask(
        `${project}:dependencies`,
        configurations,
        outDir
      )

      expect(mkdirP).toHaveBeenCalledWith(path.join(outDir, project))
      configurations.forEach((configuration) => {
        expect(getExecOutput).toHaveBeenCalledWith(
          './gradlew',
          [
            `${project}:dependencies`,
            '--configuration-cache',
            '--configuration',
            configuration
          ],
          {
            ignoreReturnCode: true,
            silent: true
          }
        )
      })
      expect(writeFileSync).toHaveBeenCalledTimes(1)
      expect(writeFileSync).toHaveBeenCalledWith(
        path.join(outDir, project, `compileClasspath.txt`),
        'stdout1'
      )
    })
  })

  describe('getProjectFromTask', () => {
    it('root', () => {
      const result = getProjectFromTask('dependencies')
      expect(result).toEqual('gradle-root-project')
    })
    it('non root', () => {
      const result = getProjectFromTask(':hoge:dependencies')
      expect(result).toEqual(':hoge')
    })
  })
})
