import { BALANCE } from '../data/balance';
import { CIDADE, RIVAL_BASE } from '../data/cidade';
import { TEMAS } from '../data/temas';
import { Rng, hashSeed } from './rng';
import type { GameState, Pauta, Tema } from './types';

export function sortearPauta(rng: Rng, anterior?: Tema): Pauta {
  const temas = (Object.keys(TEMAS) as Tema[]).filter((t) => t !== anterior);
  const tema = rng.pick(temas);
  const emCrise = rng.chance(BALANCE.pautaChanceCrise);
  const info = TEMAS[tema];
  const manchete = rng.pick(emCrise ? info.manchetesCrise : info.manchetes);
  return { tema, emCrise, manchete };
}

export interface NovoJogoOpts {
  nome: string;
  partido: string;
  avatar?: number;
  seed?: string;
}

export function novoJogo({ nome, partido, avatar = 0, seed }: NovoJogoOpts): GameState {
  const seedFinal = seed && seed.trim() ? seed.trim() : Math.random().toString(36).slice(2, 10);
  const rng = new Rng(hashSeed(seedFinal));
  const pauta = sortearPauta(rng);
  const s: GameState = {
    version: 1,
    seed: seedFinal,
    rngState: 0,
    mes: 1,
    nivel: 'cidade',
    jogador: { nome: nome.trim() || 'Candidato', partido, avatar },
    res: { ...BALANCE.inicio },
    acoesRestantes: BALANCE.acoesPorMes,
    usoAcoesMes: {},
    pauta,
    rival: {
      ...RIVAL_BASE,
      aprovacao: BALANCE.rival.aprovacaoInicial,
      midia: BALANCE.rival.midiaInicial,
      reputacao: BALANCE.rival.reputacaoInicial,
    },
    mesEleicao: BALANCE.mesEleicao,
    escandalos: [],
    perguntasFeitas: [],
    entrevista: null,
    ultimaEntrevista: null,
    relatorio: null,
    eleicao: null,
    status: 'jogando',
    fim: null,
    log: [],
    stats: { entrevistas: 0, mentiras: 0, escandalosExplodidos: 0, melhorCombo: 0, acoesRealizadas: 0 },
    proximoId: 1,
  };
  s.rngState = rng.state;
  s.log.push({
    mes: 1,
    texto: `${s.jogador.nome} assume como vereador(a) suplente em ${CIDADE.nome}. A eleição é no mês ${s.mesEleicao}.`,
    tipo: 'info',
  });
  return s;
}
