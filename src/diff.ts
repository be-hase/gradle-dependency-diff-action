import path from 'path'
import fs from 'fs'
import { DiffResult, TempDirs } from './types.js'
import * as exec from '@actions/exec'
import * as glob from '@actions/glob'
import * as io from '@actions/io'
import { removePrefix } from './utils.js'

export async function downloadJar(
  version: string,
  tempDir: string
): Promise<string> {
  const res = await fetch(
    `https://github.com/JakeWharton/dependency-tree-diff/releases/download/${version}/dependency-tree-diff.jar`
  )
  if (!res.ok) {
    throw new Error('Failed to download dependency-tree-diff.jar')
  }
  const arrayBuffer = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const jarPath = path.join(tempDir, 'dependency-tree-diff.jar')
  fs.writeFileSync(jarPath, buffer)
  return jarPath
}

export async function calculateDiffResults(
  jarPath: string,
  configuration: string,
  oldRepoDir: string,
  newRepoDir: string,
  tempDirs: TempDirs
): Promise<DiffResult[]> {
  const results: DiffResult[] = []
  const globber = await glob.create(
    path.join('**', 'build', 'reports', 'project', 'dependencies.txt')
  )
  for (const filePath of await globber.glob()) {
    const oldFilePath = path.join(
      oldRepoDir,
      removePrefix(filePath, process.env.GITHUB_WORKSPACE + path.sep)
    )
    const newFilePath = path.join(
      newRepoDir,
      removePrefix(filePath, process.env.GITHUB_WORKSPACE + path.sep)
    )
    const result = await execDiff(
      jarPath,
      configuration,
      oldFilePath,
      newFilePath,
      tempDirs.result
    )
    if (result) {
      results.push(result)
    }
  }
  return results
}

export function sortDiffResults(results: DiffResult[]) {
  return results.sort((a, b) => {
    if (a.project === b.project) {
      return a.configuration.localeCompare(b.configuration)
    } else {
      if (a.project === 'gradle-root-project') return -1
      if (b.project === 'gradle-root-project') return 1
      return a.project.localeCompare(b.project)
    }
  })
}

async function execDiff(
  jarPath: string,
  configuration: string,
  oldFilePath: string,
  newFilePath: string,
  resultDir: string
): Promise<DiffResult | undefined> {
  if (!fs.existsSync(oldFilePath)) {
    return
  }

  const project = getProjectFromFile(newFilePath)

  const output = await exec.getExecOutput(
    'java',
    ['-jar', jarPath, oldFilePath, newFilePath],
    { silent: true }
  )
  if (output.stdout) {
    const projectDir = project.split(':').filter((s) => s !== '')
    const filePath = path.join(resultDir, ...projectDir, `${configuration}.txt`)
    await io.mkdirP(path.dirname(filePath))
    fs.writeFileSync(filePath, output.stdout)

    return {
      project: project,
      configuration: configuration,
      result: output.stdout
    }
  }
  return
}

// export for testing
export function getProjectFromFile(filePath: string): string {
  const text = fs.readFileSync(filePath, 'utf-8')

  const regexps = [/Project '(\S+)'/, /Root project '(\S+)'/]
  for (const regexp of regexps) {
    const matched = text.match(regexp)
    if (matched) {
      return matched[1]
    }
  }

  throw Error('Invalid dependencies.txt')
}
