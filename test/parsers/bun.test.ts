import {describe, test, expect} from 'vitest';
import {parse} from '../../src/main.js';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';

const fixtureDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures'
);

const parseBunLock = (data: unknown) => parse(JSON.stringify(data), 'bun');

describe('bun parser', () => {
  test('parses a simple bun lock file', async () => {
    const input = await readFile(path.join(fixtureDir, 'bun.lock'), 'utf-8');
    const parsed = await parse(input, 'bun');
    expect(parsed).toMatchSnapshot();
  });

  test('parses a monorepo bun lock file', async () => {
    const input = await readFile(
      path.join(fixtureDir, 'bun-monorepo.lock'),
      'utf-8'
    );
    const parsed = await parse(input, 'bun');
    expect(parsed).toMatchSnapshot();
  });

  test('rejects when given invalid JSON', async () => {
    await expect(parse('{invalidJson: true', 'bun')).rejects.toThrow(
      'Invalid JSON format'
    );
  });

  test('rejects when the root workspace is missing', async () => {
    await expect(
      parseBunLock({
        lockfileVersion: 1,
        configVersion: 0,
        workspaces: {},
        packages: {}
      })
    ).rejects.toThrow('Invalid bun lock file: missing root package');
  });

  test('attaches peer-only dependencies when "dependencies" bucket is missing', async () => {
    const parsed = await parseBunLock({
      lockfileVersion: 1,
      workspaces: {'': {name: 'root'}},
      packages: {
        acorn: [
          'acorn@8.0.0',
          '',
          {bin: {acorn: 'bin/acorn'}},
          'sha512-deadbeef'
        ],
        'acorn-jsx': [
          'acorn-jsx@5.3.2',
          '',
          {peerDependencies: {acorn: '^6.0.0 || ^7.0.0 || ^8.0.0'}},
          'sha512-deadbeef'
        ]
      }
    });

    const acornJsx = parsed.packages.find((p) => p.name === 'acorn-jsx');
    expect(acornJsx).toBeDefined();
    expect(acornJsx?.peerDependencies.map((p) => p.name)).toEqual(['acorn']);
    expect(acornJsx?.dependencies).toEqual([]);
  });

  test('attaches root dev/peer dependencies when "dependencies" bucket is missing', async () => {
    const parsed = await parseBunLock({
      lockfileVersion: 1,
      workspaces: {
        '': {
          name: 'root',
          devDependencies: {eslint: '^9.0.0'},
          peerDependencies: {typescript: '^5'}
        }
      },
      packages: {
        eslint: ['eslint@9.0.0', '', {}, 'sha512-deadbeef'],
        typescript: ['typescript@5.0.0', '', {}, 'sha512-deadbeef']
      }
    });

    expect(parsed.root.devDependencies.map((p) => p.name)).toEqual(['eslint']);
    expect(parsed.root.peerDependencies.map((p) => p.name)).toEqual([
      'typescript'
    ]);
  });

  test('skips dependencies declared inline on 2-tuple workspace rows', async () => {
    const parsed = await parseBunLock({
      lockfileVersion: 1,
      workspaces: {
        '': {name: 'root'},
        'packages/pkg-a': {name: 'pkg-a', version: '1.0.0'},
        'packages/pkg-b': {name: 'pkg-b', version: '1.0.0'}
      },
      packages: {
        'pkg-a': [
          'pkg-a@workspace:packages/pkg-a',
          {dependencies: {'pkg-b': 'workspace:*'}}
        ],
        'pkg-b': ['pkg-b@workspace:packages/pkg-b']
      }
    });

    const pkgA = parsed.packages.find((p) => p.name === 'pkg-a');
    const pkgB = parsed.packages.find((p) => p.name === 'pkg-b');
    expect(pkgA?.version).toBe('workspace:packages/pkg-a');
    expect(pkgB?.version).toBe('workspace:packages/pkg-b');
    expect(pkgA?.dependencies).toEqual([]);
  });

  test('skips dependencies declared under workspaces[path] for 1-tuple rows', async () => {
    const parsed = await parseBunLock({
      lockfileVersion: 1,
      workspaces: {
        '': {name: 'root'},
        'packages/pkg-a': {
          name: 'pkg-a',
          version: '1.0.0',
          dependencies: {'pkg-b': 'workspace:*'}
        },
        'packages/pkg-b': {name: 'pkg-b', version: '1.0.0'}
      },
      packages: {
        'pkg-a': ['pkg-a@workspace:packages/pkg-a'],
        'pkg-b': ['pkg-b@workspace:packages/pkg-b']
      }
    });

    const pkgA = parsed.packages.find((p) => p.name === 'pkg-a');
    const pkgB = parsed.packages.find((p) => p.name === 'pkg-b');
    expect(pkgA?.version).toBe('workspace:packages/pkg-a');
    expect(pkgB?.version).toBe('workspace:packages/pkg-b');
    expect(pkgA?.dependencies).toEqual([]);
  });

  test('preserves the scoped name for scoped workspace packages', async () => {
    const parsed = await parseBunLock({
      lockfileVersion: 1,
      workspaces: {
        '': {name: 'root'},
        'packages/scoped-pkg': {
          name: '@scope/pkg',
          version: '2.5.0',
          dependencies: {'pkg-b': 'workspace:*'}
        },
        'packages/pkg-b': {name: 'pkg-b', version: '1.0.0'}
      },
      packages: {
        '@scope/pkg': ['@scope/pkg@workspace:packages/scoped-pkg'],
        'pkg-b': ['pkg-b@workspace:packages/pkg-b']
      }
    });

    const scoped = parsed.packages.find((p) => p.name === '@scope/pkg');
    expect(scoped).toBeDefined();
    expect(scoped?.version).toBe('workspace:packages/scoped-pkg');
    expect(scoped?.dependencies).toEqual([]);
  });

  test('falls back to slice-derived name/version when workspaces[path] is missing', async () => {
    const parsed = await parseBunLock({
      lockfileVersion: 1,
      workspaces: {'': {name: 'root'}},
      packages: {
        'pkg-a': ['pkg-a@workspace:packages/pkg-a']
      }
    });

    const pkgA = parsed.packages.find((p) => p.name === 'pkg-a');
    expect(pkgA).toBeDefined();
    expect(pkgA?.version).toBe('workspace:packages/pkg-a');
    expect(pkgA?.dependencies).toEqual([]);
  });

  test('treats a degenerate 2-tuple with a non-object second element as workspace-ref', async () => {
    const parsed = await parseBunLock({
      lockfileVersion: 1,
      workspaces: {
        '': {name: 'root'},
        'packages/pkg-a': {
          name: 'pkg-a',
          version: '1.0.0',
          dependencies: {'pkg-b': 'workspace:*'}
        },
        'packages/pkg-b': {name: 'pkg-b', version: '1.0.0'}
      },
      packages: {
        'pkg-a': ['pkg-a@workspace:packages/pkg-a', 'unexpected-string'],
        'pkg-b': ['pkg-b@workspace:packages/pkg-b']
      }
    });

    const pkgA = parsed.packages.find((p) => p.name === 'pkg-a');
    expect(pkgA?.version).toBe('workspace:packages/pkg-a');
    expect(pkgA?.dependencies).toEqual([]);
  });
});
