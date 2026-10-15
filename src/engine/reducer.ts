import { CIDADE } from '../data/cidade';
import { consumirEntrevista, executarAcao } from './actions';
import { checarDerrota } from './endgame';
import { concluirEntrevista, registrarResposta, sortearEntrevista } from './interview';
import { Rng } from './rng';
import { fecharMes } from './turn';
import type { GameState } from './types';

export type GameAction =
  | { type: 'ACAO'; acaoId: string }
  | { type: 'INICIAR_ENTREVISTA' }
  | { type: 'RESPONDER_PERGUNTA'; indice: number | null; tempoRestante: number }
  | { type: 'CONCLUIR_ENTREVISTA' }
  | { type: 'FECHAR_RESUMO_ENTREVISTA' }
  | { type: 'ENCERRAR_MES' }
  | { type: 'FECHAR_RELATORIO' }
  | { type: 'FINALIZAR_ELEICAO' };

/**
 * Reducer puro: nunca altera `state`, sempre devolve uma cópia nova (ou o mesmo
 * objeto se a ação for inválida). Toda aleatoriedade vem de `state.rngState`.
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  const s: GameState = structuredClone(state);
  const rng = new Rng(s.rngState);
  let mudou = false;

  switch (action.type) {
    case 'ACAO':
      mudou = executarAcao(s, action.acaoId, rng);
      break;

    case 'INICIAR_ENTREVISTA':
      if (consumirEntrevista(s)) {
        s.entrevista = sortearEntrevista(s, rng);
        mudou = true;
      }
      break;

    case 'RESPONDER_PERGUNTA':
      mudou = registrarResposta(s, action.indice, action.tempoRestante);
      break;

    case 'CONCLUIR_ENTREVISTA':
      if (s.entrevista) {
        concluirEntrevista(s);
        mudou = true;
      }
      break;

    case 'FECHAR_RESUMO_ENTREVISTA':
      if (s.ultimaEntrevista) {
        s.ultimaEntrevista = null;
        mudou = true;
      }
      break;

    case 'ENCERRAR_MES':
      if (s.status === 'jogando' && !s.entrevista && !s.relatorio) {
        s.ultimaEntrevista = null;
        fecharMes(s, rng);
        mudou = true;
      }
      break;

    case 'FECHAR_RELATORIO':
      if (s.relatorio) {
        s.relatorio = null;
        mudou = true;
      }
      break;

    case 'FINALIZAR_ELEICAO':
      if (s.status === 'eleicao' && s.eleicao) {
        s.status = 'fim';
        s.relatorio = null;
        s.fim = s.eleicao.venceu
          ? {
              vitoria: true,
              titulo: 'Eleito(a)!',
              motivo: `Você conquistou ${s.eleicao.percentualJogador}% dos votos válidos e é o(a) novo(a) vereador(a) titular de ${CIDADE.nome}. O próximo degrau é o Estado!`,
            }
          : {
              vitoria: false,
              titulo: 'Derrota nas urnas',
              motivo: `${s.rival.nome} venceu com ${s.eleicao.percentualRival}% dos votos válidos. Volte para as ruas e tente de novo.`,
            };
        mudou = true;
      }
      break;
  }

  if (!mudou) return state;

  if (s.status !== 'fim') {
    const derrota = checarDerrota(s);
    if (derrota) {
      s.status = 'fim';
      s.fim = derrota;
      s.entrevista = null;
    }
  }

  s.rngState = rng.state;
  return s;
}
