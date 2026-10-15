import { BALANCE } from '../data/balance';
import { aplicarDeltas, descreverDeltas, registrar } from './resources';
import type { Rng } from './rng';
import type { EscandaloPendente, GameState } from './types';

export function criarEscandalo(s: GameState, manchete: string, gravidade: 1 | 2 | 3): EscandaloPendente {
  const e: EscandaloPendente = { id: `esc${s.proximoId++}`, manchete, gravidade, mesCriado: s.mes };
  s.escandalos.push(e);
  return e;
}

export function chanceExplodir(e: EscandaloPendente, mesAtual: number, risco: number): number {
  const c = BALANCE.escandalo;
  const idade = Math.max(0, mesAtual - e.mesCriado);
  return Math.min(0.9, c.chanceBase + c.chancePorGravidade * e.gravidade + c.chancePorMes * idade + c.chancePorRisco * risco);
}

/** Rola cada escândalo pendente; os que explodem aplicam dano e saem da lista. Retorna as manchetes. */
export function checarEscandalos(s: GameState, rng: Rng): string[] {
  const manchetes: string[] = [];
  const restantes: EscandaloPendente[] = [];
  for (const e of s.escandalos) {
    if (rng.chance(chanceExplodir(e, s.mes, s.res.riscoInvestigacao))) {
      const imp = BALANCE.escandalo.impacto;
      const aplicado = aplicarDeltas(s.res, {
        aprovacao: imp.aprovacao * e.gravidade,
        reputacao: imp.reputacao * e.gravidade,
        midia: imp.midia * e.gravidade,
      });
      s.stats.escandalosExplodidos++;
      manchetes.push(e.manchete);
      registrar(s, `ESCÂNDALO: ${e.manchete} (${descreverDeltas(aplicado)})`, 'ruim');
    } else {
      restantes.push(e);
    }
  }
  s.escandalos = restantes;
  return manchetes;
}
