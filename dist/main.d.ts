/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export declare function run(): Promise<void>;
export declare function getGitUrl(token: string): string;
export declare function cloneBaseRepository(gitUrl: string, baseRepoDir: string): Promise<void>;
