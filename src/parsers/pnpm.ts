import {
  type ParsedLockFile,
  type ParsedDependency,
  dependencyTypes,
  type DependencyType
} from '../types.js';
import {createYamlPairReader} from '../line-reader.js';

export async function parsePnpm(input: string): Promise<ParsedLockFile> {
  const packageMap: Record<string, ParsedDependency> = {};
  const pairReader = createYamlPairReader(input);
  const root: ParsedDependency = {
    name: 'root',
    version: '',
    dependencies: [],
    devDependencies: [],
    optionalDependencies: [],
    peerDependencies: []
  };

  for (const pair of pairReader) {
    if (
      pair.path.length === 4 &&
      pair.path[0] === 'importers' &&
      pair.path[1] === '.'
    ) {
      const [, , dependencyType, packageName] = pair.path;
      const key = pair.key;

      if (key === 'version' && pair.value) {
        const versionKey = pair.value;
        const mapKey = `${packageName}@${versionKey}`;
        const currentPackage = getOrCreatePackage(
          packageMap,
          mapKey,
          packageName,
          versionKey
        );
        tryAddDependency(root, dependencyType, currentPackage);
      }
    } else if (pair.path.length === 3 && pair.path[0] === 'snapshots') {
      const [, mapKey, dependencyType] = pair.path;
      const currentPackage = getOrCreatePackage(packageMap, mapKey);
      const depVersionKey = pair.value;
      const depName = pair.key;
      const depMapKey = `${depName}@${depVersionKey}`;
      const depPackage = getOrCreatePackage(
        packageMap,
        depMapKey,
        depName,
        depVersionKey ?? undefined
      );
      tryAddDependency(currentPackage, dependencyType, depPackage);
    }
  }

  return {
    type: 'pnpm',
    packages: Object.values(packageMap),
    root
  };
}

function getOrCreatePackage(
  packageMap: Record<string, ParsedDependency>,
  mapKey: string,
  name?: string,
  versionKey?: string
): ParsedDependency {
  let pkg = packageMap[mapKey];
  const versionSeparator = mapKey.indexOf('@', 1);
  if (!versionKey) {
    versionKey = mapKey.slice(versionSeparator + 1);
  }
  if (!name) {
    name = mapKey.slice(0, versionSeparator);
  }
  if (!pkg) {
    const version = computeVersionForVersionKey(versionKey);
    pkg = {
      name,
      version,
      dependencies: [],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    };
    packageMap[mapKey] = pkg;
  }
  return pkg;
}

function tryAddDependency(
  pkg: ParsedDependency,
  dependencyType: string,
  depPackage: ParsedDependency
): void {
  // oxlint-disable-next-line no-unsafe-type-assertion
  const key = dependencyType as DependencyType;
  if (dependencyTypes.includes(key)) {
    pkg[key].push(depPackage);
  }
}

function computeVersionForVersionKey(versionKey: string): string {
  const versionKeyParens = versionKey.indexOf('(');
  return versionKeyParens !== -1
    ? versionKey.slice(0, versionKeyParens)
    : versionKey;
}
