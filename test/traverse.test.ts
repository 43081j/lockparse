import {describe, it, expect, vi} from 'vitest';
import {traverse} from '../src/traverse.js';
import type {ParsedDependency} from '../src/types.js';

describe('traverse', () => {
  it('should traverse dependencies correctly', () => {
    const root: ParsedDependency = {
      name: 'root',
      version: '1.0.0',
      dependencies: [
        {
          name: 'dep1',
          version: '1.0.0',
          dependencies: [],
          devDependencies: [
            {
              name: 'dep1-devDep1',
              version: '1.0.0',
              dependencies: [],
              devDependencies: [],
              peerDependencies: [],
              optionalDependencies: []
            }
          ],
          peerDependencies: [],
          optionalDependencies: []
        }
      ],
      devDependencies: [
        {
          name: 'devDep1',
          version: '1.0.0',
          dependencies: [],
          devDependencies: [],
          peerDependencies: [],
          optionalDependencies: []
        }
      ],
      peerDependencies: [],
      optionalDependencies: []
    };

    const visitDependency = vi.fn();
    const visitDevDependency = vi.fn();

    traverse(root, {
      dependency: visitDependency,
      devDependency: visitDevDependency
    });

    expect(visitDependency).toHaveBeenCalledTimes(1);
    expect(visitDevDependency).toHaveBeenCalledTimes(2);

    const visitedDependencies = visitDependency.mock.calls.map(
      (call) => call[0].name
    );
    const visitedDevDependencies = visitDevDependency.mock.calls.map(
      (call) => call[0].name
    );

    expect(visitedDependencies).toEqual(['dep1']);
    expect(visitedDevDependencies).toEqual(['dep1-devDep1', 'devDep1']);

    const parentOfDep1 = visitDependency.mock.calls[0][1];
    expect(parentOfDep1.name).toBe('root');

    const parentOfDep1DevDep1 = visitDevDependency.mock.calls[0][1];
    expect(parentOfDep1DevDep1.name).toBe('dep1');

    const parentMapOfDevDep1 = visitDevDependency.mock.calls[1][2];
    expect(parentMapOfDevDep1.get(visitDevDependency.mock.calls[1][0])).toBe(
      root
    );
  });
});
