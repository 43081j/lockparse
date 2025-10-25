import {describe, it, expect, vi} from 'vitest';
import {traverse, type VisitorFn} from '../src/traverse.js';
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

    const visitDependency = vi.fn<VisitorFn>();
    const visitDevDependency = vi.fn<VisitorFn>();

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

    const pathOfDep1 = visitDependency.mock.calls[0][2]!;
    expect(pathOfDep1.map((node) => node.name)).toEqual(['root']);

    const pathOfDep1DevDep1 = visitDevDependency.mock.calls[0][2]!;
    expect(pathOfDep1DevDep1.map((node) => node.name)).toEqual([
      'root',
      'dep1'
    ]);

    const pathOfDevDep1 = visitDevDependency.mock.calls[1][2]!;
    expect(pathOfDevDep1.map((node) => node.name)).toEqual(['root']);
  });

  it('should handle circular dependencies', () => {
    const root: ParsedDependency = {
      name: 'root',
      version: '1.0.0',
      dependencies: [],
      devDependencies: [],
      peerDependencies: [],
      optionalDependencies: []
    };
    // Creating a circular dependency
    const circularDep: ParsedDependency = {
      name: 'circularDep',
      version: '1.0.0',
      dependencies: [root],
      devDependencies: [],
      peerDependencies: [],
      optionalDependencies: []
    };
    root.dependencies.push(circularDep);

    const visitDependency = vi.fn<VisitorFn>();

    traverse(root, {
      dependency: visitDependency
    });

    expect(visitDependency).toHaveBeenCalledTimes(1);
    expect(visitDependency.mock.calls[0][0].name).toBe('circularDep');
  });
});
