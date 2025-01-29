import { DiffResult } from './types.js';
import { OctokitHelper } from './octokitHelper.js';
export declare function reportToChecks(octokitHelper: OctokitHelper, diffResults: DiffResult[]): Promise<string[]>;
export declare function getChecksOutput(diffResults: DiffResult[]): {
    summary: string;
    text: string | undefined;
}[];
export declare function generateHtmlReport(diffResults: DiffResult[], resultDir: string): string | undefined;
export declare function reportToCustomEndpoint(endpointUrl: string, headers: string[], html: string | undefined): Promise<string[]>;
export declare function reportToPrComment(octokitHelper: OctokitHelper, urls: string[], diffResults: DiffResult[]): Promise<void>;
export declare function reportToPrBody(octokitHelper: OctokitHelper, urls: string[], diffResults: DiffResult[]): Promise<void>;
export declare function reportToLabel(octokitHelper: OctokitHelper, diffResults: DiffResult[], labelName: string): Promise<void>;
export declare function reportToArtifact(resultDir: string): Promise<void>;
