import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import { gameReducer, type GameAction } from '../engine/reducer';
import { novoJogo, type NovoJogoOpts } from '../engine/state';
import type { GameState } from '../engine/types';
import { apagarSave, carregarSave, gravarSave } from './storage';

export type RootAction = GameAction | { type: 'NOVO_JOGO'; opts: NovoJogoOpts } | { type: 'APAGAR_JOGO' };

function rootReducer(jogo: GameState | null, action: RootAction): GameState | null {
  switch (action.type) {
    case 'NOVO_JOGO':
      return novoJogo(action.opts);
    case 'APAGAR_JOGO':
      return null;
    default:
      return jogo ? gameReducer(jogo, action) : jogo;
  }
}

interface Ctx {
  jogo: GameState | null;
  dispatch: (a: RootAction) => void;
}

const GameContext = createContext<Ctx | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [jogo, dispatch] = useReducer(rootReducer, null, carregarSave);

  // Autosave a cada mudança de estado.
  useEffect(() => {
    if (jogo) gravarSave(jogo);
    else apagarSave();
  }, [jogo]);

  return <GameContext.Provider value={{ jogo, dispatch }}>{children}</GameContext.Provider>;
}

export function useGame(): Ctx {
  const c = useContext(GameContext);
  if (!c) throw new Error('useGame fora do GameProvider');
  return c;
}

/** Para telas que só existem com jogo ativo. */
export function useJogo(): { jogo: GameState; dispatch: (a: RootAction) => void } {
  const { jogo, dispatch } = useGame();
  if (!jogo) throw new Error('Nenhum jogo ativo');
  return { jogo, dispatch };
}
