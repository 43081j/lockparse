import {describe, test, expect} from 'vitest';
import {parse} from '../../src/main.js';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';

const fixtureDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures'
);

describe('bun parser', () => {
  test('parse simple bun lock file', async () => {
    const input = await readFile(path.join(fixtureDir, 'bun.lock'), 'utf-8');
    const parsed = await parse(input, 'bun');
    expect(parsed).toMatchSnapshot();
  });

  test('links dependency edges when earlier sections are missing', async () => {
    const input = await readFile(path.join(fixtureDir, 'bun.lock'), 'utf-8');
    const parsed = await parse(input, 'bun');

    const rootDevDependencyNames = parsed.root.devDependencies.map(
      (dependency) => dependency.name
    );
    expect(rootDevDependencyNames).toEqual([
      '@eslint/js',
      '@types/bun',
      'eslint'
    ]);

    const rootPeerDependencyNames = parsed.root.peerDependencies.map(
      (dependency) => dependency.name
    );
    expect(rootPeerDependencyNames).toEqual(['typescript']);

    const acornJsx = parsed.packages.find(
      (dependency) => dependency.name === 'acorn-jsx'
    );
    expect(
      acornJsx?.peerDependencies.map((dependency) => dependency.name)
    ).toEqual(['acorn']);
  });

  test('rejects when invalid JSON', async () => {
    const input = `{invalidJson: true`;
    await expect(parse(input, 'bun')).rejects.toThrow('Invalid JSON format');
  });

  test('rejects when missing root package', async () => {
    const input = JSON.stringify({
      lockfileVersion: 1,
      configVersion: 0,
      workspaces: {},
      packages: {}
    });
    await expect(parse(input, 'bun')).rejects.toThrow(
      'Invalid bun lock file: missing root package'
    );
  });

  test('parses a monorepo bun lock file', async () => {
    const input = await readFile(
      path.join(fixtureDir, 'bun-monorepo.lock'),
      'utf-8'
    );
    const parsed = await parse(input, 'bun');
    expect(parsed).toMatchSnapshot();
  });

  test('resolves aliased dependencies', async () => {
    const input = await readFile(
      path.join(fixtureDir, 'bun-alias.lock'),
      'utf-8'
    );
    const parsed = await parse(input, 'bun');
    const rootDeps = parsed.root.dependencies.map(
      (d) => `${d.name}@${d.version}`
    );
    expect(rootDeps).toEqual(['tinyglobby@0.2.17', 'tinyexec@1.4.0']);
    const tinyglobby = parsed.root.dependencies.find(
      (d) => d.name === 'tinyglobby'
    )!;
    expect(tinyglobby.dependencies.map((d) => d.name)).toEqual([
      'fdir',
      'picomatch'
    ]);
  });
});
