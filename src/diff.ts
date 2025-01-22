import path from 'path'
import fs from 'fs'
import { DiffResult, TempDirs } from './types.js'
import * as exec from '@actions/exec'
import * as glob from '@actions/glob'
import * as io from '@actions/io'

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
  tempDirs: TempDirs
): Promise<DiffResult[]> {
  const results: DiffResult[] = []
  const globber = await glob.create(
    path.join('./', '**', 'build', 'reports', 'project', 'dependencies.txt')
  )
  for (const filePath of await globber.glob()) {
    console.log(`filePath ${filePath}`)
    const oldFilePath = path.join(tempDirs.baseRepo, filePath)
    console.log(`oldFilePath ${oldFilePath}`)
    const result = await execDiff(
      jarPath,
      configuration,
      filePath,
      oldFilePath,
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
  filePath: string,
  oldFilePath: string,
  resultDir: string
): Promise<DiffResult | undefined> {
  if (!fs.existsSync(oldFilePath)) {
    return
  }

  const project = getProjectFromFile(filePath)

  const output = await exec.getExecOutput(
    'java',
    ['-jar', jarPath, oldFilePath, filePath],
    { silent: true }
  )
  if (output.stdout) {
    const projectDir = project.split(':').filter((s) => s !== '')
    const filePath = path.join(
      resultDir,
      projectDir.join(path.sep),
      `${configuration}.txt`
    )
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
