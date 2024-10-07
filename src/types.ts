export const BASE_REPO_DIR_NAME = 'base-repo'
export const BASE_DEPENDENCIES_DIR_NAME = 'base-dependencies'
export const CURRENT_DEPENDENCIES_DIR_NAME = 'current-dependencies'

export interface Inputs {
  includeProjectRegex: string
  excludeProjectRegex: string
  includeRootProject: boolean
  configurations: string
  token: string
  toolVersion: string
  postPrComment: boolean
  updatePrBody: boolean
  assignLabel: boolean
  labelName: string
}

export interface GradleOptions {
  includeProjectRegex: string
  excludeProjectRegex: string
  includeRootProject: boolean
  configurations: string
}

export interface TempDirs {
  root: string
  baseRepo: string
  baseDependencies: string
  currentDependencies: string
}

export interface DiffResult {
  project: string
  configuration: string
  result: string
}
