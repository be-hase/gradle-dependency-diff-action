import path from 'path'
import fs from 'fs'
import { DiffResult, TempDirs } from './types'
import * as exec from '@actions/exec'
import * as glob from '@actions/glob'

export async function downloadJar(
  version: string,
  tempDir: string
): Promise<string> {
  const res = await fetch(
    `https://github.com/JakeWharton/dependency-tree-diff/releases/download/${version}/dependency-tree-diff.jar`
  )
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
    const result = await execDiff(jarPath, filePath, oldFilePath)
    if (result) {
      results.push(result)
    }
  }
  return results
}

export function getOldFilePath(
  filePath: string,
  baseDependenciesDir: string
): string {
  return path.join(baseDependenciesDir, ...filePath.split(path.sep).slice(-2))
}

async function execDiff(
  jarPath: string,
  filePath: string,
  oldFilePath: string
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
    return {
      project: project,
      configuration: configuration,
      result: output.stdout
    }
  }
  return
}

export function getProjectFromFilePath(filePath: string): string {
  return path.basename(path.dirname(filePath))
}

export function getConfigurationFromFilePath(filePath: string): string {
  return path.basename(filePath).replace(/\.txt$/, '')
}
