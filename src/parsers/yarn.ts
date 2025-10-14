import {
  type ParsedLockFile,
  type ParsedDependency,
  type PackageJsonLike,
  type DependencyType,
  dependencyTypes
} from '../types.js';
import {createYamlPairReader, createLineReader} from '../line-reader.js';

export async function parseYarn(
  input: string,
  packageJson?: PackageJsonLike
): Promise<ParsedLockFile> {
  const isV1 = input.includes('yarn lockfile v1');
  const packageMap: Record<string, ParsedDependency> = {};

  if (isV1) {
    processYarnV1(input, packageMap);
  } else {
    processYarn(input, packageMap);
  }

  const root: ParsedDependency = {
    name: 'root',
    version: '',
    dependencies: [],
    devDependencies: [],
    optionalDependencies: [],
    peerDependencies: []
  };

  if (packageJson) {
    root.version = packageJson.version ?? '';
    processRootDependencies(packageJson, root, packageMap);
  }

  return {
    type: 'yarn',
    packages: Object.values(packageMap),
    root
  };
}

const indentPattern = /^( *)/;
const quotePattern = /^['"]|['"]$/g;

function processYarnV1(
  input: string,
  packageMap: Record<string, ParsedDependency>
): void {
  const lineReader = createLineReader(input);
  let currentPackage: ParsedDependency | null = null;
  let currentDepType: DependencyType | null = null;

  for (const line of lineReader) {
    if (line === '') {
      continue;
    }

    const indentMatch = line.match(indentPattern);
    const indentSize = indentMatch ? indentMatch[1].length : 0;

    if (indentSize === 0 && line.endsWith(':')) {
      const pkgKeys = line.slice(0, -1).split(', ');
      currentPackage = null;
      for (const pkgKeyRaw of pkgKeys) {
        const pkgKey = pkgKeyRaw.replace(quotePattern, '');
        if (!currentPackage) {
          let pkg = packageMap[pkgKey];
          if (!pkg) {
            pkg = {
              name: '',
              version: '',
              dependencies: [],
              devDependencies: [],
              optionalDependencies: [],
              peerDependencies: []
            };
            packageMap[pkgKey] = pkg;
          }
          currentPackage = pkg;
          if (!pkg.name) {
            const separatorIndex = pkgKey.indexOf('@', 1);
            const name = pkgKey.slice(0, separatorIndex);
            pkg.name = name;
          }
        } else {
          packageMap[pkgKey] = currentPackage;
        }
      }
      continue;
    }

    if (indentSize === 2) {
      if (line.endsWith(':')) {
        const key = line.slice(indentSize, -1);
        // oxlint-disable-next-line no-unsafe-type-assertion
        if (dependencyTypes.includes(key as DependencyType)) {
          // oxlint-disable-next-line no-unsafe-type-assertion
          currentDepType = key as DependencyType;
        }
      } else {
        const separatorIndex = line.indexOf(' ', indentSize);
        const key = line.slice(indentSize, separatorIndex);
        const value = line.slice(separatorIndex + 1);
        if (key === 'version' && currentPackage) {
          currentPackage.version = value.replace(quotePattern, '');
        }
      }
      continue;
    }

    if (indentSize === 4 && currentDepType && currentPackage) {
      const separatorIndex = line.indexOf(' ', indentSize);
      const depName = line
        .slice(indentSize, separatorIndex)
        .replace(quotePattern, '');
      const depSemver = line
        .slice(separatorIndex + 1)
        .replace(quotePattern, '');
      const depPkgKey = `${depName}@${depSemver}`;
      let depPkg = packageMap[depPkgKey];
      if (!depPkg) {
        depPkg = {
          name: depName,
          version: '',
          dependencies: [],
          devDependencies: [],
          optionalDependencies: [],
          peerDependencies: []
        };
        packageMap[depPkgKey] = depPkg;
      }
      currentPackage[currentDepType].push(depPkg);
    }
  }
}

function processYarn(
  input: string,
  packageMap: Record<string, ParsedDependency>
): void {
  const pairReader = createYamlPairReader(input);
  const optionalDependencies: Array<[string, string]> = [];

  for (const pair of pairReader) {
    if (pair.path.length == 0 && !pair.value && pair.key.includes('@npm:')) {
      const pkgKeys = pair.key.split(', ');
      let pkg: ParsedDependency | undefined;
      for (const pkgKey of pkgKeys) {
        if (packageMap[pkgKey]) {
          pkg = packageMap[pkgKey];
          break;
        }
      }
      if (!pkg) {
        pkg = {
          name: '',
          version: '',
          dependencies: [],
          devDependencies: [],
          optionalDependencies: [],
          peerDependencies: []
        };
      }
      packageMap[pair.key] = pkg;
      for (const pkgKey of pkgKeys) {
        if (!pkg.name) {
          const separatorIndex = pkgKey.indexOf('@', 1);
          const name = pkgKey.slice(0, separatorIndex);
          pkg.name = name;
        }
        packageMap[pkgKey] = pkg;
      }
    } else if (pair.path.length === 1 && pair.key === 'version' && pair.value) {
      const [pkgKey] = pair.path;
      const pkg = packageMap[pkgKey];
      if (pkg) {
        pkg.version = pair.value;
      }
    } else if (
      pair.path.length === 2 &&
      pair.value &&
      // oxlint-disable-next-line no-unsafe-type-assertion
      dependencyTypes.includes(pair.path[1] as DependencyType)
    ) {
      const [pkgKey, depType] = pair.path;
      const depName = pair.key;
      const depSemver = pair.value;
      const pkg = packageMap[pkgKey];
      const depPkgKey = `${depName}@${depSemver}`;
      let depPkg = packageMap[depPkgKey];
      if (!depPkg) {
        depPkg = {
          name: depName,
          version: '',
          dependencies: [],
          devDependencies: [],
          optionalDependencies: [],
          peerDependencies: []
        };
        packageMap[depPkgKey] = depPkg;
      }
      if (pkg) {
        // oxlint-disable-next-line no-unsafe-type-assertion
        pkg[depType as DependencyType].push(depPkg);
      }
    } else if (
      pair.path.length === 3 &&
      pair.value === 'true' &&
      pair.key === 'optional' &&
      pair.path[1] === 'dependenciesMeta'
    ) {
      const pkgKey = pair.path[0];
      optionalDependencies.push([pkgKey, pair.path[2]]);
    }
  }

  for (const [pkgKey, depName] of optionalDependencies) {
    const pkg = packageMap[pkgKey];
    if (pkg) {
      const deps = pkg.dependencies;
      const index = deps.findIndex((d) => d.name === depName);
      if (index !== -1) {
        const [dep] = deps.splice(index, 1);
        pkg.optionalDependencies.push(dep);
      }
    }
  }
}

function processRootDependencies(
  packageJson: PackageJsonLike,
  root: ParsedDependency,
  packageMap: Record<string, ParsedDependency>
): void {
  for (const depType of dependencyTypes) {
    const deps = packageJson[depType];
    if (!deps) {
      continue;
    }
    const destination = root[depType];
    for (const [depName, semver] of Object.entries(deps)) {
      const mapKey = `${depName}@npm:${semver}`;
      const existing = packageMap[mapKey];
      if (existing) {
        destination.push(existing);
      }
    }
  }
}
