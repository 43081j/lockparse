import {describe, test, expect} from 'vitest';
import {parse} from '../../src/main.js';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';

const fixtureDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures'
);

describe('pnpm parser', () => {
  test('parse simple pnpm lock file', async () => {
    const input = `
lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:
  .:
    dependencies:
      some-package:
        version: 1.2.3
        specifier: ^1.2.3

packages:
  'some-package@1.2.3':
    resolution:
      {
        integrity: sha512-abc123...
      }
    engines:
      node: '>=12'
`;
    const parsed = await parse(input, 'pnpm');
    expect(parsed).toMatchSnapshot();
  });

  test('parses a complex pnpm lock file', async () => {
    const input = await readFile(
      path.join(fixtureDir, 'pnpm-lock.yaml'),
      'utf-8'
    );
    const parsed = await parse(input, 'pnpm');
    expect(parsed).toMatchSnapshot();
  });
});
