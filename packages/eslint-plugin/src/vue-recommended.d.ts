import type { FlatConfig } from '@typescript-eslint/utils/ts-eslint';
import { VueVersion } from './common';
export interface VueEslintOptions {
    alias?: {
        map?: Array<[string, string]>;
        extensions?: string[];
    };
}
export declare const getVueEsLint: (ver: VueVersion, options?: VueEslintOptions) => FlatConfig.ConfigArray;
