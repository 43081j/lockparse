import type {ParsedDependency, DependencyType} from './types.js';

export type VisitorFn = (
  node: ParsedDependency,
  parent: ParsedDependency | null,
  path?: ParsedDependency[]
) => unknown;

export interface Visitor {
  dependency?: VisitorFn;
  devDependency?: VisitorFn;
  peerDependency?: VisitorFn;
  optionalDependency?: VisitorFn;
}

const visitorKeys: Array<[keyof Visitor, DependencyType]> = [
  ['dependency', 'dependencies'],
  ['devDependency', 'devDependencies'],
  ['peerDependency', 'peerDependencies'],
  ['optionalDependency', 'optionalDependencies']
];

function traverseInternal(
  node: ParsedDependency,
  visitor: Visitor,
  path: ParsedDependency[]
): void {
  for (const [visitorKey, nodeKey] of visitorKeys) {
    if (visitor[visitorKey]) {
      const newPath = [...path, node];

      for (const dep of node[nodeKey]) {
        if (path.includes(dep)) {
          continue;
        }
        if (visitor[visitorKey](dep, node, newPath) !== false) {
          traverseInternal(dep, visitor, newPath);
        }
      }
    }
  }
}

export function traverse(node: ParsedDependency, visitor: Visitor): void {
  return traverseInternal(node, visitor, []);
}
