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
  /^(?<indent> *)(['"](?<quotedKey>[^"']+)["']|(?<key>[^:]+)):( (["'](?<quotedValue>[^"']+)["']|(?<value>.+)))?$/;
const spacePattern = /^(?<spaces> *)[^ ]/;

export interface YamlPair {
  indent: number;
  key: string;
  value: string | null;
  path: string[];
}

export function* createYamlPairReader(
  input: string
): Generator<YamlPair, void, unknown> {
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
      const {
        indent,
        key: unquotedKey,
        value: unquotedValue,
        quotedKey,
        quotedValue
      } = pairMatch.groups;
      const key = quotedKey ?? unquotedKey;
      const value = quotedValue ?? unquotedValue;
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
