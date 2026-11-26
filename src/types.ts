export type DependencyType =
  | 'dependencies'
  | 'devDependencies'
  | 'peerDependencies'
  | 'optionalDependencies';

export const dependencyTypes: ReadonlyArray<DependencyType> = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies'
];

export interface ParsedDependency {
  name: string;
  version: string;
  dependencies: ParsedDependency[];
  devDependencies: ParsedDependency[];
  peerDependencies: ParsedDependency[];
  optionalDependencies: ParsedDependency[];
}

export type LockFileType = 'npm' | 'yarn' | 'pnpm' | 'bun';

export interface ParsedLockFile {
  type: LockFileType;

  packages: ParsedDependency[];

  root: ParsedDependency;
}

export interface PackageJsonLike {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, {optional?: boolean}>;
}
