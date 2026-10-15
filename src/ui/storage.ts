import { desserializar, serializar } from '../engine/save';
import type { GameState } from '../engine/types';

const CHAVE = 'ascensao.save.v1';

export function carregarSave(): GameState | null {
  try {
    return desserializar(localStorage.getItem(CHAVE));
  } catch {
    return null;
  }
}

export function gravarSave(s: GameState): void {
  try {
    localStorage.setItem(CHAVE, serializar(s));
  } catch {
    /* armazenamento indisponível: o jogo segue sem save */
  }
}

export function apagarSave(): void {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* ignora */
  }
}
