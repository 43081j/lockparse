import type {ParsedDependency, DependencyType} from './types.js';

export interface Visitor {
  dependency?: (
    node: ParsedDependency,
    parent: ParsedDependency | null,
    parentMap: WeakMap<ParsedDependency, ParsedDependency>
  ) => unknown;
  devDependency?: (
    node: ParsedDependency,
    parent: ParsedDependency | null,
    parentMap: WeakMap<ParsedDependency, ParsedDependency>
  ) => unknown;
  peerDependency?: (
    node: ParsedDependency,
    parent: ParsedDependency | null,
    parentMap: WeakMap<ParsedDependency, ParsedDependency>
  ) => unknown;
  optionalDependency?: (
    node: ParsedDependency,
    parent: ParsedDependency | null,
    parentMap: WeakMap<ParsedDependency, ParsedDependency>
  ) => unknown;
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
  parentMap: WeakMap<ParsedDependency, ParsedDependency>
): void {
  for (const [visitorKey, nodeKey] of visitorKeys) {
    if (visitor[visitorKey]) {
      for (const dep of node[nodeKey]) {
        parentMap.set(dep, node);
        if (visitor[visitorKey](dep, node, parentMap) !== false) {
          traverseInternal(dep, visitor, parentMap);
        }
      }
    }
  }
}

export function traverse(node: ParsedDependency, visitor: Visitor): void {
  const parentMap = new WeakMap<ParsedDependency, ParsedDependency>();
  return traverseInternal(node, visitor, parentMap);
}
