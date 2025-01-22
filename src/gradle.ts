import * as exec from '@actions/exec'

export async function generateDependenciesFiles(
  configuration: string,
  cwd?: string
): Promise<void> {
  await exec.getExecOutput(
    './gradlew',
    ['clean dependencyReport', '--configuration', configuration],
    {
      cwd: cwd
    }
  )
}
