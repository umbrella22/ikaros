import type { FlatConfig } from '@typescript-eslint/utils/ts-eslint';
export declare enum VueVersion {
    v2 = 2,
    v3 = 3
}
export declare const parserOptions: FlatConfig.ParserOptions;
export declare const settings: {
    'import-x/ignore': string[];
};
export declare const ignores: string[];
export declare const tsFileExtensions: string[];
export declare const jsFileExtensions: string[];
export declare const assetExtends: string[];
export declare const esRules: FlatConfig.Config['rules'];
export declare const tsRules: FlatConfig.Config['rules'];
export declare const dtsRules: FlatConfig.Config['rules'];
