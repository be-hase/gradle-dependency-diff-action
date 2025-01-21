import { DiffResult, TempDirs } from './types.js';
export declare function downloadJar(version: string, tempDir: string): Promise<string>;
export declare function calculateDiff(jarPath: string, tempDirs: TempDirs): Promise<DiffResult[]>;
export declare function getOldFilePath(filePath: string, baseDependenciesDir: string): string;
export declare function getProjectFromFilePath(filePath: string): string;
export declare function getConfigurationFromFilePath(filePath: string): string;
