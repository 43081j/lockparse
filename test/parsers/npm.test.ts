import {describe, test, expect} from 'vitest';
import {parse} from '../../src/main.js';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';

const fixtureDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures'
);

describe('npm parser', () => {
  test('parse simple npm lock file', async () => {
    const input = JSON.stringify({
      name: 'example-project',
      version: '1.0.0',
      lockfileVersion: 2,
      packages: {
        '': {
          name: 'example-project',
          version: '1.0.0',
          dependencies: {}
        }
      }
    });
    const parsed = await parse(input, 'npm');
    expect(parsed).toMatchSnapshot();
  });

  test('rejects when invalid JSON', async () => {
    const input = `{invalidJson: true`;
    await expect(parse(input, 'npm')).rejects.toThrow('Invalid JSON format');
  });

  test('rejects when missing root package', async () => {
    const input = JSON.stringify({
      name: 'example-project',
      version: '1.0.0',
      lockfileVersion: 2,
      packages: {
        'node_modules/some-package': {
          name: 'some-package',
          version: '1.2.3'
        }
      }
    });
    await expect(parse(input, 'npm')).rejects.toThrow(
      'Invalid npm lock file: missing root package'
    );
  });

  test('parses a complex npm lock file', async () => {
    const input = await readFile(
      path.join(fixtureDir, 'package-lock.json'),
      'utf-8'
    );
    const parsed = await parse(input, 'npm');
    expect(parsed).toMatchSnapshot();
  });
});
