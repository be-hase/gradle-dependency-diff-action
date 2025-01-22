import { DiffResult, TempDirs } from './types.js';
export declare function downloadJar(version: string, tempDir: string): Promise<string>;
export declare function calculateDiffResults(jarPath: string, configuration: string, tempDirs: TempDirs): Promise<DiffResult[]>;
export declare function sortDiffResults(results: DiffResult[]): DiffResult[];
export declare function getProjectFromFile(filePath: string): string;
