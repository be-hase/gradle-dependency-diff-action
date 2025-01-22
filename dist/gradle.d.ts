import { GradleOptions } from './types.js';
export declare function generateDependenciesFiles(gradleOptions: GradleOptions, outDir: string, cwd?: string): Promise<void>;
export declare function execGradleProjects(cwd?: string): Promise<string>;
export declare function parseGradleProjects(projectsOutput: string): string[];
export declare function filterGradleProjects(projects: string[], includeProjectRegex: string, excludeProjectRegex: string): string[];
export declare function getDependenciesTasks(projects: string[], includeRootProject: boolean): string[];
export declare function execDependenciesTask(task: string, configuration: string, outDir: string, cwd?: string): Promise<void>;
export declare function getProjectFromTask(task: string): string;
