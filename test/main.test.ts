import {describe, it, expect} from 'vitest';
import {parse, traverse} from '../src/main.js';

describe('main', () => {
  it('exports correct functions', () => {
    expect(typeof parse).toBe('function');
    expect(typeof traverse).toBe('function');
  });
});
