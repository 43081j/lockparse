# 🔒 lockparse

> A tiny, zero-dependency lockfile parser for npm, Yarn, pnpm, and Bun.

**⚠️ IMPORTANT**: This library is in early development, and the API may change without warning.

## Installation

```bash
npm install lockparse
```

## Usage

```ts
import { parse } from 'lockparse';
import { readFile } from 'node:fs/promises';

const lockfileContent = await readFile('./package-lock.json', 'utf-8');
const packageJson = JSON.parse(await readFile('./package.json', 'utf-8'));
const lockfile = await parse(lockfileContent, 'npm', packageJson);

console.log(lockfile.root);
```

## API

### `parse(input, typeOrFileName, packageJson?)`

Parses a lockfile and returns a structured representation of the dependency tree.

#### Parameters

- **`input`** (`string`): The lockfile content as a string
- **`typeOrFileName`** (`string`): The lockfile type or filename. Supported values:
  - `'npm'` or `'package-lock.json'` - npm lockfile
  - `'yarn'` or `'yarn.lock'` - Yarn lockfile
  - `'pnpm'` or `'pnpm-lock.yaml'` - pnpm lockfile
  - `'bun'` or `'bun.lock'` - Bun lockfile
- **`packageJson`** (`PackageJsonLike`, optional): The package.json object (optional but recommended for better accuracy)

#### Returns

`Promise<ParsedLockFile>` - A promise that resolves to an object with:

- **`type`** (`LockFileType`): The detected lockfile type
- **`packages`** (`ParsedDependency[]`): A flat array of all packages in the lockfile
- **`root`** (`ParsedDependency`): The root dependency node representing the project's dependency tree

#### Note: Yarn parsing

When parsing Yarn lockfiles, the `packageJson` parameter is highly recommended. Without it, the root node will not contain any dependencies as the Yarn lock file does not include this information. All packages will however still be contained in the `packages` array.

## License

MIT
