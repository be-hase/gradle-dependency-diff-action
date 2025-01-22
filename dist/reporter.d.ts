import { DiffResult } from './types.js';
import { OctokitHelper } from './octokitHelper.js';
export declare function reportAsChecks(octokitHelper: OctokitHelper, diffResults: DiffResult[]): Promise<string[]>;
export declare function getChecksOutput(diffResults: DiffResult[]): {
    summary: string;
    text: string | undefined;
}[];
export declare function reportAsPrComment(octokitHelper: OctokitHelper, urls: string[], diffResults: DiffResult[]): Promise<void>;
export declare function reportAsPrBody(octokitHelper: OctokitHelper, urls: string[], diffResults: DiffResult[]): Promise<void>;
export declare function reportAsLabel(octokitHelper: OctokitHelper, diffResults: DiffResult[], labelName: string): Promise<void>;
