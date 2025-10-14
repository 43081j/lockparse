import type {ParsedLockFile, LockFileType, PackageJsonLike} from './types.js';
import {parseNpm} from './parsers/npm.js';
import {parseYarn} from './parsers/yarn.js';
import {parsePnpm} from './parsers/pnpm.js';
import {parseBun} from './parsers/bun.js';

const typeMap: Record<string, LockFileType> = {
  'package-lock.json': 'npm',
  'yarn.lock': 'yarn',
  'pnpm-lock.yaml': 'pnpm',
  'bun.lock': 'bun',
  npm: 'npm',
  yarn: 'yarn',
  pnpm: 'pnpm',
  bun: 'bun'
};

export * from './types.js';
export * from './traverse.js';

export function parse(
  input: string,
  typeOrFileName: string,
  packageJson?: PackageJsonLike
): Promise<ParsedLockFile> {
  const lockFileType = typeMap[typeOrFileName];

  switch (lockFileType) {
    case 'npm':
      return parseNpm(input);
    case 'yarn':
      return parseYarn(input, packageJson);
    case 'pnpm':
      return parsePnpm(input);
    case 'bun':
      return parseBun(input);
    default:
      throw new Error(`Unsupported lock file type: ${typeOrFileName}`);
  }
}
