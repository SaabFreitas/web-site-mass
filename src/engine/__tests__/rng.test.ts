import { describe, expect, it } from 'vitest';
import { Rng, hashSeed } from '../rng';

describe('Rng', () => {
  it('é determinístico para a mesma seed', () => {
    const a = new Rng(hashSeed('ascensao'));
    const b = new Rng(hashSeed('ascensao'));
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('seeds diferentes geram sequências diferentes', () => {
    const a = new Rng(hashSeed('a'));
    const b = new Rng(hashSeed('b'));
    expect([a.next(), a.next()]).not.toEqual([b.next(), b.next()]);
  });

  it('int respeita limites inclusivos', () => {
    const r = new Rng(42);
    const vistos = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.int(1, 3);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(3);
      vistos.add(v);
    }
    expect(vistos).toEqual(new Set([1, 2, 3]));
  });

  it('pode ser retomado a partir do estado salvo', () => {
    const a = new Rng(7);
    a.next();
    a.next();
    const b = new Rng(a.state);
    expect(b.next()).toBe(a.next());
  });

  it('shuffle preserva os elementos', () => {
    const r = new Rng(1);
    expect(r.shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
