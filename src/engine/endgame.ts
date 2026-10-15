import { BALANCE } from '../data/balance';
import type { FimDeJogo, GameState } from './types';

/** Verifica derrotas imediatas (fora da eleição). */
export function checarDerrota(s: GameState): FimDeJogo | null {
  if (s.res.reputacao <= 0) {
    return {
      vitoria: false,
      titulo: 'Cassado!',
      motivo: 'Sua reputação chegou a zero. A Câmara abriu processo e cassou seu mandato.',
    };
  }
  if (s.res.dinheiro < BALANCE.economia.limiteDivida) {
    return {
      vitoria: false,
      titulo: 'Falido!',
      motivo: 'As dívidas ficaram impagáveis. Sem dinheiro, sua carreira política acabou antes da eleição.',
    };
  }
  return null;
}
