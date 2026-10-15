import { BALANCE } from '../data/balance';
import type { Deltas, GameState, ResourceKey, Resources } from './types';

const LIMITES: Partial<Record<ResourceKey, [number, number]>> = {
  aprovacao: [0, 100],
  midia: [0, 100],
  reputacao: [0, 100],
  riscoInvestigacao: [0, 100],
  capitalPolitico: [0, 999],
};

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

const arred = (v: number) => Math.round(v * 10) / 10;

/** Fator de retorno decrescente para ganhos de aprovação. */
export function fatorAprovacao(atual: number): number {
  const r = BALANCE.retornoDecrescente;
  return clamp((r.referencia - atual) / r.divisor, r.minimo, r.maximo);
}

/**
 * Aplica deltas aos recursos (com limites e retorno decrescente na aprovação).
 * Retorna os deltas efetivamente aplicados.
 */
export function aplicarDeltas(res: Resources, deltas: Deltas): Deltas {
  const aplicado: Deltas = {};
  for (const key of Object.keys(deltas) as ResourceKey[]) {
    let d = deltas[key] ?? 0;
    if (d === 0) continue;
    if (key === 'aprovacao' && d > 0) d *= fatorAprovacao(res.aprovacao);
    const antes = res[key];
    const lim = LIMITES[key];
    let depois = arred(antes + d);
    if (lim) depois = clamp(depois, lim[0], lim[1]);
    res[key] = depois;
    const real = arred(depois - antes);
    if (real !== 0) aplicado[key] = real;
  }
  return aplicado;
}

export const ROTULO_RECURSO: Record<ResourceKey, string> = {
  dinheiro: 'Dinheiro',
  aprovacao: 'Aprovação',
  capitalPolitico: 'Capital político',
  midia: 'Mídia',
  reputacao: 'Reputação',
  riscoInvestigacao: 'Risco',
};

export function formatarDinheiro(v: number): string {
  const sinal = v < 0 ? '-' : '';
  return `${sinal}R$ ${Math.abs(Math.round(v)).toLocaleString('pt-BR')}`;
}

/** Texto curto para um conjunto de deltas, ex.: "+3 Aprovação, -R$ 300". Ignora o risco (oculto). */
export function descreverDeltas(d: Deltas): string {
  const partes: string[] = [];
  for (const key of Object.keys(d) as ResourceKey[]) {
    if (key === 'riscoInvestigacao') continue;
    const v = d[key] ?? 0;
    if (v === 0) continue;
    if (key === 'dinheiro') partes.push(`${v > 0 ? '+' : ''}${formatarDinheiro(v)}`);
    else partes.push(`${v > 0 ? '+' : ''}${Math.round(v * 10) / 10} ${ROTULO_RECURSO[key]}`);
  }
  return partes.join(', ');
}

export function registrar(s: GameState, texto: string, tipo: GameState['log'][number]['tipo'] = 'info') {
  s.log.push({ mes: s.mes, texto, tipo });
  if (s.log.length > 120) s.log.splice(0, s.log.length - 120);
}
