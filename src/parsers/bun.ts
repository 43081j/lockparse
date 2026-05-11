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
  version?: string;
}

type BunLockFilePackage = [
  versionKey: string,
  _unknown: string,
  packageInfo: BunDependencyInfo,
  hash: string
];

type BunLockFileInlineDepsPackage = [
  versionKey: string,
  packageInfo: BunDependencyInfo
];

type BunLockFileWorkspacePackage = [versionKey: string];

type BunLockFilePackageEntry =
  | BunLockFilePackage
  | BunLockFileInlineDepsPackage
  | BunLockFileWorkspacePackage;

interface BunLockFileLike {
  workspaces?: Record<string, BunLockFileWorkspace>;
  packages: Record<string, BunLockFilePackageEntry>;
}

type ResolvedEntry =
  | {kind: 'inline'; versionKey: string; depInfo: BunDependencyInfo}
  | {kind: 'workspace-ref'; versionKey: string};

const trailingCommaRegex = /,(?=\s+[}\]])/g;
const workspacePrefix = 'workspace:';

export async function parseBun(input: string): Promise<ParsedLockFile> {
  let lockFile: BunLockFileLike;

  try {
    // Bun lock files are JavaScript because the Bun devs like trailing commas
    const withoutTrailing = input.replaceAll(trailingCommaRegex, '');
    lockFile = JSON.parse(withoutTrailing);
  } catch {
    return Promise.reject(new Error('Invalid JSON format'));
  }

  const workspaces = lockFile.workspaces ?? {};
  const rootPackage = workspaces[''];

  if (!rootPackage) {
    throw new Error('Invalid bun lock file: missing root package');
  }

  const {packages, root} = processPackages(rootPackage, lockFile.packages);

  return {
    type: 'bun',
    packages,
    root
  };
}

function resolveEntry(entry: BunLockFilePackageEntry): ResolvedEntry {
  const versionKey = entry[0];

  if (entry.length === 4) {
    return {kind: 'inline', versionKey, depInfo: entry[2]};
  }

  if (entry.length === 2) {
    const second = entry[1];
    if (typeof second === 'object' && second !== null) {
      return {kind: 'inline', versionKey, depInfo: second};
    }
  }

  return {kind: 'workspace-ref', versionKey};
}

function parseVersionKey(versionKey: string): {name: string; version: string} {
  const versionIndex = versionKey.indexOf('@', 1);
  if (versionIndex === -1) {
    return {name: versionKey, version: ''};
  }
  return {
    name: versionKey.slice(0, versionIndex),
    version: versionKey.slice(versionIndex + 1)
  };
}

function isWorkspaceVersion(version: string): boolean {
  return version.startsWith(workspacePrefix);
}

function buildPackage(versionKey: string): ParsedDependency {
  const {name, version} = parseVersionKey(versionKey);
  return {
    name,
    version,
    dependencies: [],
    devDependencies: [],
    peerDependencies: [],
    optionalDependencies: []
  };
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

  // Pre-resolve every entry once so pass-1 and pass-2 share the parsed shape.
  const resolved: Array<[string, ResolvedEntry]> = Object.entries(input).map(
    ([pkgKey, pkgInfo]) => [pkgKey, resolveEntry(pkgInfo)]
  );

  for (const [pkgKey, entry] of resolved) {
    packageMap[pkgKey] = buildPackage(entry.versionKey);
  }

  for (const [pkgKey, entry] of resolved) {
    const pkg = packageMap[pkgKey];
    const {version} = parseVersionKey(entry.versionKey);
    if (isWorkspaceVersion(version)) {
      continue;
    }

    switch (entry.kind) {
      case 'inline':
        processDependencies(entry.depInfo, pkg, packageMap, pkgKey);
        break;
      // TODO: Figure out how to handle monorepo setups
      case 'workspace-ref':
        break;
    }
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
      continue;
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
