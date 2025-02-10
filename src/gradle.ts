import * as exec from '@actions/exec'
import * as core from '@actions/core'

export async function generateDependenciesFiles(
  configuration: string,
  cwd?: string
): Promise<void> {
  try {
    await exec.getExecOutput(
      './gradlew',
      [
        'clean',
        'dependencyReport',
        '--continue',
        '--configuration',
        configuration
      ],
      {
        cwd: cwd
      }
    )
  } catch (error) {
    if (error instanceof Error) {
      core.info(error.message)
    }
  }
}
