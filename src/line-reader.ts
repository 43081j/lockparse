export function* createLineReader(input: string) {
  let newLineIndex = input.indexOf('\n');
  let lastIndex = 0;

  while (newLineIndex !== -1) {
    const line = input.slice(lastIndex, newLineIndex).trimEnd();
    lastIndex = newLineIndex + 1;
    newLineIndex = input.indexOf('\n', lastIndex);
    yield line;
  }
}

const yamlPairPattern =
  /^(?<indent> *)(['"](?<key>[^"']+)["']|(?<key>[^:]+)):( (["'](?<value>[^"']+)["']|(?<value>.+)))?$/;
const spacePattern = /^(?<spaces> *)[^ ]/;

export function* createYamlPairReader(input: string) {
  const lineReader = createLineReader(input);
  let lastIndent = 0;
  const path: string[] = [];
  let lastKey: string | null = null;

  for (const line of lineReader) {
    if (line === '') {
      continue;
    }

    const pairMatch = line.match(yamlPairPattern);

    if (pairMatch && pairMatch.groups) {
      const {indent, key, value} = pairMatch.groups;
      const indentSize = indent.length;
      adjustPath(indentSize, lastIndent, lastKey, path);
      yield {
        indent: indent.length,
        key,
        value: value ?? null,
        path
      };
      lastKey = key;
      lastIndent = indentSize;
    } else {
      const spaceMatch = line.match(spacePattern);
      if (spaceMatch && spaceMatch.groups) {
        const {spaces} = spaceMatch.groups;
        const indentSize = spaces.length;
        adjustPath(indentSize, lastIndent, lastKey, path);
        lastIndent = indentSize;
      }
    }
  }
}

function adjustPath(
  indentSize: number,
  lastIndent: number,
  lastKey: string | null,
  path: string[]
) {
  if (indentSize > lastIndent) {
    if (lastKey !== null) {
      path.push(lastKey);
    }
  } else if (indentSize < lastIndent) {
    const indentDiff = (lastIndent - indentSize) / 2;
    path.splice(Math.max(path.length - indentDiff, 0), indentDiff);
  }
}
