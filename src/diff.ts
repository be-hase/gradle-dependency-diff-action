import path from 'path'
import fs from 'fs'
import { DiffResult, TempDirs } from './types.js'
import * as exec from '@actions/exec'
import * as glob from '@actions/glob'

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

export async function calculateDiff(
  jarPath: string,
  tempDirs: TempDirs
): Promise<DiffResult[]> {
  const results: DiffResult[] = []
  const globber = await glob.create(
    path.join(tempDirs.currentDependencies, '**', '*.txt')
  )
  for (const filePath of await globber.glob()) {
    const oldFilePath = getOldFilePath(filePath, tempDirs.baseDependencies)
    const result = await execDiff(
      jarPath,
      filePath,
      oldFilePath,
      tempDirs.result
    )
    if (result) {
      results.push(result)
    }
  }
  return sortDiffResults(results)
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

// export for testing
export function getOldFilePath(
  filePath: string,
  baseDependenciesDir: string
): string {
  return path.join(baseDependenciesDir, ...filePath.split(path.sep).slice(-2))
}

async function execDiff(
  jarPath: string,
  filePath: string,
  oldFilePath: string,
  resultDir: string
): Promise<DiffResult | undefined> {
  if (!fs.existsSync(oldFilePath)) {
    return
  }

  const project = getProjectFromFilePath(filePath)
  const configuration = getConfigurationFromFilePath(filePath)

  const output = await exec.getExecOutput('java', [
    '-jar',
    jarPath,
    oldFilePath,
    filePath
  ])
  if (output.stdout) {
    const projectDir = project.split(':').filter((s) => s !== '')
    fs.writeFileSync(
      path.join(resultDir, projectDir.join(path.sep), `${configuration}.txt`),
      output.stdout
    )
    return {
      project: project,
      configuration: configuration,
      result: output.stdout
    }
  }
  return
}

// export for testing
export function getProjectFromFilePath(filePath: string): string {
  return path.basename(path.dirname(filePath))
}

// export for testing
export function getConfigurationFromFilePath(filePath: string): string {
  return path.basename(filePath).replace(/\.txt$/, '')
}
