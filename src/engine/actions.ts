import { BALANCE } from '../data/balance';
import { getAcao } from '../data/acoes';
import { aplicarDeltas, descreverDeltas, registrar } from './resources';
import type { Rng } from './rng';
import { criarEscandalo } from './scandals';
import type { AcaoMensal, Deltas, GameState, ResourceKey } from './types';

export type MotivoBloqueio = 'sem-tempo' | 'limite-mes' | 'sem-dinheiro' | 'sem-capital' | 'jogo-parado';

export function bloqueioAcao(s: GameState, acao: AcaoMensal): MotivoBloqueio | null {
  if (s.status !== 'jogando' || s.entrevista || s.relatorio) return 'jogo-parado';
  if (s.acoesRestantes <= 0) return 'sem-tempo';
  if ((s.usoAcoesMes[acao.id] ?? 0) >= acao.maxPorMes) return 'limite-mes';
  if (acao.especial === 'entrevista' && (s.usoAcoesMes[acao.id] ?? 0) >= BALANCE.entrevistasPorMes) return 'limite-mes';
  if (acao.custo?.dinheiro && s.res.dinheiro - acao.custo.dinheiro < BALANCE.economia.limiteDivida) return 'sem-dinheiro';
  if (acao.custo?.capitalPolitico && s.res.capitalPolitico < acao.custo.capitalPolitico) return 'sem-capital';
  return null;
}

export const TEXTO_BLOQUEIO: Record<MotivoBloqueio, string> = {
  'sem-tempo': 'Sem tempo neste mês',
  'limite-mes': 'Já feito este mês',
  'sem-dinheiro': 'Dinheiro insuficiente',
  'sem-capital': 'Capital político insuficiente',
  'jogo-parado': 'Indisponível agora',
};

function consumir(s: GameState, acao: AcaoMensal) {
  s.acoesRestantes--;
  s.usoAcoesMes[acao.id] = (s.usoAcoesMes[acao.id] ?? 0) + 1;
  s.stats.acoesRealizadas++;
}

/** Executa uma ação comum do mês. Retorna false se não pôde. */
export function executarAcao(s: GameState, acaoId: string, rng: Rng): boolean {
  const acao = getAcao(acaoId);
  if (!acao || acao.especial || bloqueioAcao(s, acao)) return false;
  consumir(s, acao);

  const deltas: Deltas = {};
  if (acao.custo?.dinheiro) deltas.dinheiro = -acao.custo.dinheiro;
  if (acao.custo?.capitalPolitico) deltas.capitalPolitico = -acao.custo.capitalPolitico;
  for (const key of Object.keys(acao.efeitos) as ResourceKey[]) {
    const [min, max] = acao.efeitos[key]!;
    deltas[key] = (deltas[key] ?? 0) + rng.int(min, max);
  }
  const aplicado = aplicarDeltas(s.res, deltas);
  if (acao.suja) criarEscandalo(s, acao.suja.manchete, acao.suja.gravidade);
  registrar(s, `${acao.icone} ${acao.nome}: ${descreverDeltas(aplicado) || 'sem efeito visível'}.`, acao.suja ? 'alerta' : 'info');
  return true;
}

/** Consome a ação de entrevista (o mini game em si roda na UI). */
export function consumirEntrevista(s: GameState): boolean {
  const acao = getAcao('entrevista');
  if (!acao || bloqueioAcao(s, acao)) return false;
  consumir(s, acao);
  return true;
}
