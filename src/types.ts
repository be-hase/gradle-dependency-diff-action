export const RESULT_DIR_NAME = 'result'

export interface Inputs {
  configurations: string
  token: string
  oldRepoDir: string
  newRepoDir: string
  toolVersion: string
  postPrComment: boolean
  updatePrBody: boolean
  assignLabel: boolean
  labelName: string
  uploadArtifact: boolean
  customEndpointUrl: string
  customEndpointHeaders: string[]
}

export interface TempDirs {
  root: string
  result: string
}

export interface DiffResult {
  project: string
  configuration: string
  result: string
}
