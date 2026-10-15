import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../data/balance';
import { balancoMensal } from '../economy';
import { aplicarDeltas, fatorAprovacao } from '../resources';
import { gameReducer } from '../reducer';
import { novoJogo } from '../state';
import type { Resources } from '../types';

const base = (): Resources => ({ ...BALANCE.inicio });

describe('economia', () => {
  it('saldo mensal = salário - gabinete quando não há dívida', () => {
    const b = balancoMensal(base());
    expect(b.delta).toBe(BALANCE.economia.salario - BALANCE.economia.despesasGabinete);
  });

  it('cobra juros sobre dívida', () => {
    const r = base();
    r.dinheiro = -4000;
    const b = balancoMensal(r);
    expect(b.delta).toBe(BALANCE.economia.salario - BALANCE.economia.despesasGabinete - 200);
    expect(b.linhas.some((l) => l.rotulo.includes('Juros'))).toBe(true);
  });

  it('limita recursos de 0 a 100 e devolve o delta aplicado', () => {
    const r = base();
    r.midia = 98;
    const d = aplicarDeltas(r, { midia: 10, reputacao: -500 });
    expect(r.midia).toBe(100);
    expect(r.reputacao).toBe(0);
    expect(d.midia).toBe(2);
  });

  it('ganhos de aprovação têm retorno decrescente', () => {
    expect(fatorAprovacao(80)).toBeLessThan(fatorAprovacao(20));
    const baixo = base();
    baixo.aprovacao = 20;
    const alto = base();
    alto.aprovacao = 80;
    expect(aplicarDeltas(baixo, { aprovacao: 5 }).aprovacao!).toBeGreaterThan(aplicarDeltas(alto, { aprovacao: 5 }).aprovacao!);
  });
});

describe('fechamento do mês', () => {
  it('avança o mês, renova ações e aplica salário', () => {
    let s = novoJogo({ nome: 'T', partido: 'PVP', seed: 'mes' });
    s = gameReducer(s, { type: 'ACAO', acaoId: 'visitar' });
    const dinheiroAntes = s.res.dinheiro;
    s = gameReducer(s, { type: 'ENCERRAR_MES' });
    expect(s.mes).toBe(2);
    expect(s.acoesRestantes).toBe(BALANCE.acoesPorMes);
    expect(s.res.dinheiro).toBe(dinheiroAntes + BALANCE.economia.salario - BALANCE.economia.despesasGabinete);
    expect(s.relatorio).not.toBeNull();
  });

  it('não deixa agir com o relatório aberto', () => {
    let s = novoJogo({ nome: 'T', partido: 'PVP', seed: 'rel' });
    s = gameReducer(s, { type: 'ENCERRAR_MES' });
    expect(gameReducer(s, { type: 'ACAO', acaoId: 'visitar' })).toBe(s);
  });

  it('ações gastam recursos e respeitam o limite por mês', () => {
    let s = novoJogo({ nome: 'T', partido: 'PVP', seed: 'acoes' });
    s = gameReducer(s, { type: 'ACAO', acaoId: 'beneficente' });
    expect(s.res.dinheiro).toBe(BALANCE.inicio.dinheiro - 1800);
    const de_novo = gameReducer(s, { type: 'ACAO', acaoId: 'beneficente' });
    expect(de_novo).toBe(s);
  });

  it('doação "por fora" dá dinheiro rápido, sobe o risco e cria escândalo', () => {
    let s = novoJogo({ nome: 'T', partido: 'PVP', seed: 'sujo' });
    s = gameReducer(s, { type: 'ACAO', acaoId: 'caixa2' });
    expect(s.res.dinheiro).toBeGreaterThanOrEqual(BALANCE.inicio.dinheiro + 5000);
    expect(s.res.riscoInvestigacao).toBeGreaterThan(0);
    expect(s.escandalos).toHaveLength(1);
  });

  it('é determinístico: mesma seed + mesmas ações = mesmo estado', () => {
    const jogar = () => {
      let s = novoJogo({ nome: 'T', partido: 'PVP', seed: 'det' });
      s = gameReducer(s, { type: 'ACAO', acaoId: 'visitar' });
      s = gameReducer(s, { type: 'ACAO', acaoId: 'comerciantes' });
      s = gameReducer(s, { type: 'ENCERRAR_MES' });
      return s;
    };
    expect(jogar()).toEqual(jogar());
  });
});
