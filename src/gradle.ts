import * as exec from '@actions/exec'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as io from '@actions/io'
import * as core from '@actions/core'

export interface ProjectOptions {
  includeProjectRegex: string
  excludeProjectRegex: string
  includeRootProject: boolean
  configurations: string[]
}

export async function generateDependenciesFiles(
  projectOptions: ProjectOptions,
  outDir: string,
  cwd?: string
): Promise<void> {
  const projectsOutput = await execGradleProjects(cwd)
  let projects = parseGradleProjects(projectsOutput)

  projects = filterGradleProjects(
    projects,
    projectOptions.includeProjectRegex,
    projectOptions.excludeProjectRegex
  )
  core.info(`[${cwd ? 'base' : 'current'}] Detected projects: ${projects}`)

  const tasks = getDependenciesTasks(
    projects,
    projectOptions.includeRootProject
  )
  core.info(`[${cwd ? 'base' : 'current'}] Detected tasks: ${tasks}`)

  for (const task of tasks) {
    await execDependenciesTask(task, projectOptions.configurations, outDir, cwd)
  }
}

export async function execGradleProjects(cwd?: string): Promise<string> {
  const output = await exec.getExecOutput('./gradlew', ['projects'], {
    cwd: cwd,
    silent: true
  })
  return output.stdout
}

export function parseGradleProjects(projectsOutput: string): string[] {
  const regex = /Project '([\S]+)'/g
  const matches: string[] = []
  let match
  while ((match = regex.exec(projectsOutput)) !== null) {
    matches.push(match[1])
  }
  return matches
}

export function filterGradleProjects(
  projects: string[],
  includeProjectRegex: string,
  excludeProjectRegex: string
): string[] {
  let result: string[] = projects
  if (includeProjectRegex) {
    const regex = new RegExp(includeProjectRegex)
    result = result.filter(it => it.match(regex))
  }
  if (excludeProjectRegex) {
    const regex = new RegExp(excludeProjectRegex)
    result = result.filter(it => !it.match(regex))
  }
  return result
}

export function getDependenciesTasks(
  projects: string[],
  includeRootProject: boolean
): string[] {
  const tasks = projects.map(it => `${it}:dependencies`)
  if (includeRootProject) {
    return ['dependencies', ...tasks]
  }
  return tasks
}

export async function execDependenciesTask(
  task: string,
  configurations: string[],
  outDir: string,
  cwd?: string
): Promise<void> {
  const project = getProject(task)
  await io.mkdirP(path.join(outDir, project))

  for (const configuration of configurations) {
    core.info(
      `[${cwd ? 'base' : 'current'}] Executing './gradlew ${task} --configuration ${configuration}'`
    )
    const output = await exec.getExecOutput(
      './gradlew',
      [task, '--configuration', configuration],
      { cwd: cwd, ignoreReturnCode: true, silent: true }
    )
    if (output.exitCode != 0) {
      continue
    }
    fs.writeFileSync(
      path.join(outDir, project, `${configuration}.txt`),
      output.stdout
    )
  }
}

export function getProject(task: string): string {
  if (task === 'dependencies') {
    return 'root'
  } else {
    return task.replace(/:dependencies$/, '')
  }
}
