import { getPergunta } from '../../data/perguntas';
import { getJornalista } from '../../data/jornalistas';
import { CIDADE } from '../../data/cidade';
import { pontuarResposta } from '../interview';
import { gameReducer } from '../reducer';
import type { GameState, RespostaJogador } from '../types';

/** Escolhe, para cada pergunta, a resposta não-mentirosa de maior aprovação. */
export function respostasBoas(s: GameState): RespostaJogador[] {
  const ent = s.entrevista!;
  const j = getJornalista(ent.jornalistaId);
  return ent.perguntaIds.map((id) => {
    const p = getPergunta(id);
    let melhor = 0;
    let melhorPts = -Infinity;
    p.respostas.forEach((r, i) => {
      if (r.mentira) return;
      const pts = pontuarResposta(
        { perfil: j.perfil, temaPergunta: p.tema, pauta: s.pauta, cidade: CIDADE, combo: 0 },
        { tom: r.tom, mentira: false, tempoRestante: 8 },
      ).aprovacao;
      if (pts > melhorPts) {
        melhorPts = pts;
        melhor = i;
      }
    });
    return { perguntaId: id, indice: melhor, tempoRestante: 8 };
  });
}

export function respostasAleatorias(s: GameState, salt: number): RespostaJogador[] {
  return s.entrevista!.perguntaIds.map((id, k) => ({
    perguntaId: id,
    indice: (k + salt) % getPergunta(id).respostas.length,
    tempoRestante: 5,
  }));
}

/** Responde todas as perguntas pendentes e encerra a entrevista. */
export function responderEConcluir(s: GameState, respostas: RespostaJogador[]): GameState {
  for (const r of respostas) s = gameReducer(s, { type: 'RESPONDER_PERGUNTA', indice: r.indice, tempoRestante: r.tempoRestante });
  return gameReducer(s, { type: 'CONCLUIR_ENTREVISTA' });
}

/** Joga um mês com uma lista de ações preferidas; fecha relatórios automaticamente. */
export function jogarMes(s: GameState, plano: string[], estilo: 'bom' | 'aleatorio' = 'bom'): GameState {
  for (const acao of plano) {
    if (s.status !== 'jogando') break;
    if (acao === 'entrevista') {
      const antes = s;
      s = gameReducer(s, { type: 'INICIAR_ENTREVISTA' });
      if (s === antes) continue;
      s = responderEConcluir(s, estilo === 'bom' ? respostasBoas(s) : respostasAleatorias(s, s.mes));
      s = gameReducer(s, { type: 'FECHAR_RESUMO_ENTREVISTA' });
    } else {
      s = gameReducer(s, { type: 'ACAO', acaoId: acao });
    }
  }
  if (s.status === 'jogando') {
    s = gameReducer(s, { type: 'ENCERRAR_MES' });
    if (s.status === 'jogando') s = gameReducer(s, { type: 'FECHAR_RELATORIO' });
  }
  return s;
}
