import type { GameState } from './types';

export const SAVE_VERSION = 1;

export function serializar(s: GameState): string {
  return JSON.stringify(s);
}

/** Lê e valida um save. Retorna null se estiver corrompido ou em versão incompatível. */
export function desserializar(texto: string | null | undefined): GameState | null {
  if (!texto) return null;
  try {
    const s = JSON.parse(texto) as Partial<GameState>;
    if (!s || s.version !== SAVE_VERSION) return null;
    if (typeof s.mes !== 'number' || typeof s.rngState !== 'number' || !s.res || !s.jogador || !s.pauta) return null;
    const recursos = ['dinheiro', 'aprovacao', 'capitalPolitico', 'midia', 'reputacao', 'riscoInvestigacao'] as const;
    if (recursos.some((k) => typeof s.res![k] !== 'number')) return null;
    return s as GameState;
  } catch {
    return null;
  }
}
