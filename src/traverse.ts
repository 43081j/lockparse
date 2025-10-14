import type {ParsedDependency, DependencyType} from './types.js';

export interface Visitor {
  dependency?: (
    node: ParsedDependency,
    parent: ParsedDependency | null
  ) => unknown;
  devDependency?: (
    node: ParsedDependency,
    parent: ParsedDependency | null
  ) => unknown;
  peerDependency?: (
    node: ParsedDependency,
    parent: ParsedDependency | null
  ) => unknown;
  optionalDependency?: (
    node: ParsedDependency,
    parent: ParsedDependency | null
  ) => unknown;
}

const visitorKeys: Array<[keyof Visitor, DependencyType]> = [
  ['dependency', 'dependencies'],
  ['devDependency', 'devDependencies'],
  ['peerDependency', 'peerDependencies'],
  ['optionalDependency', 'optionalDependencies']
];

export function traverse(node: ParsedDependency, visitor: Visitor): void {
  for (const [visitorKey, nodeKey] of visitorKeys) {
    if (visitor[visitorKey]) {
      for (const dep of node[nodeKey]) {
        if (visitor[visitorKey](dep, node) !== false) {
          traverse(dep, visitor);
        }
      }
    }
  }
}
