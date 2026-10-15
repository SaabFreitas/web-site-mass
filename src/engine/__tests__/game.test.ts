import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../data/balance';
import { gameReducer } from '../reducer';
import { desserializar, serializar } from '../save';
import { novoJogo } from '../state';
import { jogarMes } from './helpers';

const PLANO_ATIVO = ['entrevista', 'visitar', 'projeto', 'beneficente', 'gabinete', 'comerciantes', 'panfletos', 'visitar'];

describe('partida completa', () => {
  it('chega à eleição no mês configurado e termina o jogo', () => {
    let s = novoJogo({ nome: 'T', partido: 'PVP', seed: 'completa' });
    for (let i = 0; i < BALANCE.mesEleicao && s.status === 'jogando'; i++) s = jogarMes(s, PLANO_ATIVO);
    expect(s.status).toBe('eleicao');
    expect(s.eleicao).not.toBeNull();
    s = gameReducer(s, { type: 'FINALIZAR_ELEICAO' });
    expect(s.status).toBe('fim');
    expect(s.fim?.vitoria).toBe(s.eleicao!.venceu);
  });

  it('reputação zerada causa cassação', () => {
    let s = novoJogo({ nome: 'T', partido: 'PVP', seed: 'cassado' });
    s = { ...s, res: { ...s.res, reputacao: 0.5 } };
    s.escandalos = [{ id: 'x', manchete: 'Bomba!', gravidade: 3, mesCriado: -20 }];
    // Fecha meses até o escândalo explodir.
    for (let i = 0; i < 6 && s.status === 'jogando'; i++) {
      s = gameReducer(s, { type: 'ENCERRAR_MES' });
      s = gameReducer(s, { type: 'FECHAR_RELATORIO' });
    }
    expect(s.status).toBe('fim');
    expect(s.fim?.titulo).toBe('Cassado!');
  });

  it('save/load preserva o estado e rejeita lixo', () => {
    let s = novoJogo({ nome: 'T', partido: 'PVP', seed: 'save' });
    s = jogarMes(s, PLANO_ATIVO);
    expect(desserializar(serializar(s))).toEqual(s);
    expect(desserializar('{nada')).toBeNull();
    expect(desserializar(JSON.stringify({ ...s, version: 99 }))).toBeNull();
    expect(desserializar(null)).toBeNull();
  });
});

describe('balanceamento (simulação com bots)', () => {
  const N = 200;
  const taxaVitoria = (plano: string[], estilo: 'bom' | 'aleatorio') => {
    let vitorias = 0;
    for (let i = 0; i < N; i++) {
      let s = novoJogo({ nome: 'Bot', partido: 'PVP', seed: `bal-${i}` });
      while (s.status === 'jogando') s = jogarMes(s, plano, estilo);
      if (s.status === 'eleicao' && s.eleicao!.venceu) vitorias++;
    }
    return vitorias / N;
  };

  it('jogador ativo e bom de entrevista vence na maioria das vezes', () => {
    expect(taxaVitoria(PLANO_ATIVO, 'bom')).toBeGreaterThan(0.7);
  });

  it('jogador passivo quase sempre perde', () => {
    expect(taxaVitoria([], 'bom')).toBeLessThan(0.1);
  });

  it('jogador ativo mas que responde no chute fica no meio', () => {
    const t = taxaVitoria(PLANO_ATIVO, 'aleatorio');
    expect(t).toBeGreaterThan(0.1);
    expect(t).toBeLessThan(0.9);
  });
});
