import { GitHub } from '@actions/github/lib/utils.js';
import { DiffResult } from './types.js';
import { OctokitHelper } from './octokitHelper.js';
export declare function reportAsChecks(octokit: InstanceType<typeof GitHub>, diffResults: DiffResult[]): Promise<string>;
export declare function getChecksOutput(diffResults: DiffResult[]): {
    title: string;
    summary: string;
    text?: string;
};
export declare function reportAsPrComment(octokit: InstanceType<typeof GitHub>, checksUrl: string, diffResults: DiffResult[]): Promise<void>;
export declare function findCommentByTag(octokit: InstanceType<typeof GitHub>, tag: string): Promise<number>;
export declare function reportAsPrBody(octokitHelper: OctokitHelper, checksUrl: string, diffResults: DiffResult[]): Promise<void>;
export declare function reportAsLabel(octokitHelper: OctokitHelper, diffResults: DiffResult[], labelName: string): Promise<void>;
