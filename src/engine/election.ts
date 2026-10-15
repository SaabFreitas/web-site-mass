import { BALANCE } from '../data/balance';
import type { Rng } from './rng';
import type { ResultadoEleicao } from './types';

export interface Candidatura {
  aprovacao: number;
  midia: number;
  reputacao: number;
  /** Pontos de campanha (estrutura, dinheiro). */
  campanha: number;
}

export function pontosCampanha(dinheiro: number): number {
  const e = BALANCE.eleicao;
  return Math.max(0, Math.min(e.tetoCampanha, dinheiro / e.reaisPorPontoCampanha));
}

export function forcaEleitoral(c: Candidatura): number {
  const e = BALANCE.eleicao;
  return Math.max(1, c.aprovacao + c.midia * e.pesoMidia + c.reputacao * e.pesoReputacao + c.campanha);
}

/** Probabilidade "de pesquisa" (sem ruído) do jogador ter mais votos. */
export function participacaoEsperada(jogador: Candidatura, rival: Candidatura): number {
  const fj = forcaEleitoral(jogador);
  return fj / (fj + forcaEleitoral(rival));
}

export function calcularEleicao(
  jogador: Candidatura,
  rival: Candidatura,
  eleitores: number,
  rng: Rng,
  cargo = 'Vereador(a)',
): ResultadoEleicao {
  const e = BALANCE.eleicao;
  const share = Math.min(0.95, Math.max(0.05, participacaoEsperada(jogador, rival) + rng.noise(e.ruido)));
  const comparecimento = rng.float(e.comparecimento[0], e.comparecimento[1]);
  const votantes = Math.round(eleitores * comparecimento);
  const brancosNulos = Math.round(votantes * rng.float(e.brancosNulos[0], e.brancosNulos[1]));
  const validos = votantes - brancosNulos;
  const votosJogador = Math.round(validos * share);
  const votosRival = validos - votosJogador;
  return {
    cargo,
    eleitores,
    comparecimento: votantes,
    votosJogador,
    votosRival,
    brancosNulos,
    percentualJogador: Math.round((votosJogador / validos) * 1000) / 10,
    percentualRival: Math.round((votosRival / validos) * 1000) / 10,
    venceu: votosJogador > votosRival,
  };
}
