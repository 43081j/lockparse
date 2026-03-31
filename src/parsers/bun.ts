import {
  type ParsedLockFile,
  type ParsedDependency,
  dependencyTypes
} from '../types.js';

interface BunDependencyInfo {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

interface BunLockFileWorkspace extends BunDependencyInfo {
  name: string;
}

type BunLockFilePackage = [
  versionKey: string,
  _unknown: string,
  packageInfo: BunDependencyInfo,
  hash: string
];

type BunLockFileWorkspacePackage = [versionKey: string];

type BunLockFilePackageEntry = BunLockFilePackage | BunLockFileWorkspacePackage;

interface BunLockFileLike {
  workspaces?: Record<string, BunLockFileWorkspace>;
  packages: Record<string, BunLockFilePackageEntry>;
}

const trailingCommaRegex = /,(?=\s+[}\]])/g;

export async function parseBun(input: string): Promise<ParsedLockFile> {
  let lockFile: BunLockFileLike;

  try {
    // Bun lock files are JavaScript because the Bun devs like trailing commas
    const withoutTrailing = input.replaceAll(trailingCommaRegex, '');
    lockFile = JSON.parse(withoutTrailing);
  } catch {
    return Promise.reject(new Error('Invalid JSON format'));
  }

  const rootPackage = lockFile.workspaces?.[''];

  if (!rootPackage) {
    throw new Error('Invalid bun lock file: missing root package');
  }

  const {packages, root} = processPackages(rootPackage, lockFile.packages);

  const parsed: ParsedLockFile = {
    type: 'bun',
    packages,
    root
  };

  return parsed;
}

function processPackages(
  rootPackage: BunLockFileWorkspace,
  input: Record<string, BunLockFilePackageEntry>
): {
  root: ParsedDependency;
  packages: ParsedDependency[];
} {
  const packageMap: Record<string, ParsedDependency> = {};
  const root: ParsedDependency = {
    name: 'root',
    version: '',
    dependencies: [],
    devDependencies: [],
    optionalDependencies: [],
    peerDependencies: []
  };

  for (const [pkgKey, pkgInfo] of Object.entries(input)) {
    const [versionKey] = pkgInfo;
    const versionIndex = versionKey.indexOf('@', 1);
    const version = versionKey.slice(versionIndex + 1);
    const name = versionKey.slice(0, versionIndex);
    const pkg: ParsedDependency = {
      name,
      version,
      dependencies: [],
      devDependencies: [],
      peerDependencies: [],
      optionalDependencies: []
    };
    packageMap[pkgKey] = pkg;
  }

  for (const [pkgKey, pkgInfo] of Object.entries(input)) {
    const [, , packageInfo] = pkgInfo;

    // probably a workspace entry, which doesn't have dependency info
    if (!packageInfo) {
      continue;
    }

    const pkg = packageMap[pkgKey];
    processDependencies(packageInfo, pkg, packageMap, pkgKey);
  }

  processDependencies(rootPackage, root, packageMap);

  return {packages: Object.values(packageMap), root};
}

function processDependencies(
  rootInfo: BunDependencyInfo,
  root: ParsedDependency,
  packageMap: Record<string, ParsedDependency>,
  prefix?: string
): void {
  for (const depType of dependencyTypes) {
    const collection = rootInfo[depType];
    if (!collection) {
      return;
    }
    for (const name of Object.keys(collection)) {
      let pkg: ParsedDependency | undefined;
      if (prefix) {
        pkg = packageMap[`${prefix}/${name}`];
      }
      if (!pkg) {
        pkg = packageMap[name];
      }
      if (pkg) {
        root[depType].push(pkg);
      }
    }
  }
}
