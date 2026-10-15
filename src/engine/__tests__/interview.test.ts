import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../data/balance';
import { CIDADE } from '../../data/cidade';
import { JORNALISTAS } from '../../data/jornalistas';
import { PERGUNTAS } from '../../data/perguntas';
import { pontuarEntrevista, pontuarResposta, multiplicadorCombo, type ContextoResposta } from '../interview';
import { gameReducer } from '../reducer';
import { novoJogo } from '../state';
import type { Pauta, PerfilJornalista } from '../types';
import { responderEConcluir } from './helpers';

const pautaNeutra: Pauta = { tema: 'saude', emCrise: false, manchete: '' };
const ctx = (perfil: PerfilJornalista, extra: Partial<ContextoResposta> = {}): ContextoResposta => ({
  perfil,
  temaPergunta: 'economia',
  pauta: pautaNeutra,
  cidade: CIDADE,
  combo: 0,
  ...extra,
});

describe('conteúdo da entrevista', () => {
  it('tem pelo menos 30 perguntas com 3-4 respostas e ids únicos', () => {
    expect(PERGUNTAS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(PERGUNTAS.map((p) => p.id)).size).toBe(PERGUNTAS.length);
    for (const p of PERGUNTAS) {
      expect(p.respostas.length).toBeGreaterThanOrEqual(3);
      expect(p.respostas.length).toBeLessThanOrEqual(4);
      expect(p.respostas.some((r) => r.tom === 'honesta')).toBe(true);
    }
  });

  it('tem os 4 perfis de jornalista', () => {
    expect(new Set(JORNALISTAS.map((j) => j.perfil))).toEqual(new Set(['hostil', 'neutro', 'amigo', 'sensacionalista']));
  });
});

describe('pontuarResposta', () => {
  it('jornalista hostil premia honestidade e pune evasão', () => {
    const honesta = pontuarResposta(ctx('hostil'), { tom: 'honesta', mentira: false, tempoRestante: 3 });
    const evasiva = pontuarResposta(ctx('hostil'), { tom: 'evasiva', mentira: false, tempoRestante: 3 });
    expect(honesta.aprovacao).toBeGreaterThan(0);
    expect(evasiva.aprovacao).toBeLessThan(0);
  });

  it('sensacionalista prefere populismo a honestidade', () => {
    const pop = pontuarResposta(ctx('sensacionalista'), { tom: 'populista', mentira: false, tempoRestante: 3 });
    const hon = pontuarResposta(ctx('sensacionalista'), { tom: 'honesta', mentira: false, tempoRestante: 3 });
    expect(pop.aprovacao).toBeGreaterThan(hon.aprovacao);
    expect(pop.midia).toBeGreaterThan(hon.midia);
  });

  it('mentir rende mais pontos que a mesma resposta verdadeira', () => {
    const verdade = pontuarResposta(ctx('neutro'), { tom: 'populista', mentira: false, tempoRestante: 3 });
    const mentira = pontuarResposta(ctx('neutro'), { tom: 'populista', mentira: true, tempoRestante: 3 });
    expect(mentira.aprovacao).toBeGreaterThan(verdade.aprovacao);
  });

  it('pergunta da pauta do mês amplifica o resultado', () => {
    const fora = pontuarResposta(ctx('neutro'), { tom: 'honesta', mentira: false, tempoRestante: 3 });
    const naPauta = pontuarResposta(ctx('neutro', { temaPergunta: 'saude' }), { tom: 'honesta', mentira: false, tempoRestante: 3 });
    expect(naPauta.aprovacao).toBeGreaterThan(fora.aprovacao);
  });

  it('evasiva em tema de crise é punida extra', () => {
    const crise: Pauta = { tema: 'saude', emCrise: true, manchete: '' };
    const normal = pontuarResposta(ctx('neutro', { temaPergunta: 'saude' }), { tom: 'evasiva', mentira: false, tempoRestante: 3 });
    const emCrise = pontuarResposta(ctx('neutro', { temaPergunta: 'saude', pauta: crise }), { tom: 'evasiva', mentira: false, tempoRestante: 3 });
    expect(emCrise.aprovacao).toBeLessThan(normal.aprovacao);
  });

  it('tempo esgotado zera o combo e pune', () => {
    const r = pontuarResposta(ctx('amigo', { combo: 3 }), { tom: null, mentira: false, tempoRestante: 0 });
    expect(r.combo).toBe(0);
    expect(r.aprovacao).toBe(BALANCE.entrevista.tempoEsgotado.aprovacao);
  });

  it('acertos seguidos aumentam o combo e o multiplicador', () => {
    const r1 = pontuarResposta(ctx('neutro', { combo: 0 }), { tom: 'honesta', mentira: false, tempoRestante: 3 });
    const r3 = pontuarResposta(ctx('neutro', { combo: 2 }), { tom: 'honesta', mentira: false, tempoRestante: 3 });
    expect(r1.combo).toBe(1);
    expect(r3.combo).toBe(3);
    expect(r3.aprovacao).toBeGreaterThan(r1.aprovacao);
    expect(multiplicadorCombo(99)).toBe(BALANCE.entrevista.comboMax);
  });
});

describe('pontuarEntrevista e fluxo no reducer', () => {
  it('soma as respostas e conta mentiras', () => {
    const q = PERGUNTAS.find((p) => p.respostas.some((r) => r.mentira))!;
    const idxMentira = q.respostas.findIndex((r) => r.mentira);
    const res = pontuarEntrevista('paulo', [{ perguntaId: q.id, indice: idxMentira, tempoRestante: 2 }], pautaNeutra);
    expect(res.mentiras).toBe(1);
    expect(res.linhas).toHaveLength(1);
  });

  it('mentir cria escândalo pendente e respostas ausentes viram tempo esgotado', () => {
    let s = novoJogo({ nome: 'Teste', partido: 'PVP', seed: 'mentiroso' });
    s = gameReducer(s, { type: 'INICIAR_ENTREVISTA' });
    expect(s.entrevista).not.toBeNull();
    expect(s.acoesRestantes).toBe(BALANCE.acoesPorMes - 1);
    const ent = s.entrevista!;
    const respostas = ent.perguntaIds.map((id) => {
      const p = PERGUNTAS.find((x) => x.id === id)!;
      const i = p.respostas.findIndex((r) => r.mentira);
      return { perguntaId: id, indice: i >= 0 ? i : 0, tempoRestante: 4 };
    });
    const mentiras = respostas.filter((r) => PERGUNTAS.find((p) => p.id === r.perguntaId)!.respostas[r.indice].mentira).length;
    s = responderEConcluir(s, respostas);
    expect(s.escandalos.length).toBe(mentiras);
    expect(s.entrevista).toBeNull();
    expect(s.ultimaEntrevista).not.toBeNull();
    expect(s.perguntasFeitas).toHaveLength(5);
  });

  it('não repete perguntas entre entrevistas até esgotar o banco', () => {
    let s = novoJogo({ nome: 'T', partido: 'PVP', seed: 'repeticao' });
    s = gameReducer(s, { type: 'INICIAR_ENTREVISTA' });
    const primeiras = s.entrevista!.perguntaIds;
    s = gameReducer(s, { type: 'CONCLUIR_ENTREVISTA' });
    s = gameReducer(s, { type: 'FECHAR_RESUMO_ENTREVISTA' });
    s = gameReducer(s, { type: 'INICIAR_ENTREVISTA' });
    for (const id of s.entrevista!.perguntaIds) expect(primeiras).not.toContain(id);
  });

  it('grava cada resposta no estado: recarregar não permite refazer', () => {
    let s = novoJogo({ nome: 'T', partido: 'PVP', seed: 'recarga' });
    s = gameReducer(s, { type: 'INICIAR_ENTREVISTA' });
    s = gameReducer(s, { type: 'RESPONDER_PERGUNTA', indice: 0, tempoRestante: 5 });
    expect(s.entrevista!.respostas).toHaveLength(1);
    expect(s.entrevista!.respostas[0].perguntaId).toBe(s.entrevista!.perguntaIds[0]);
    // índice inválido vira tempo esgotado
    s = gameReducer(s, { type: 'RESPONDER_PERGUNTA', indice: 99, tempoRestante: 5 });
    expect(s.entrevista!.respostas[1]).toMatchObject({ indice: null, tempoRestante: 0 });
    for (let i = 0; i < 3; i++) s = gameReducer(s, { type: 'RESPONDER_PERGUNTA', indice: 0, tempoRestante: 50 });
    expect(s.entrevista!.respostas[4].tempoRestante).toBe(BALANCE.tempoResposta);
    // não aceita mais respostas que perguntas
    expect(gameReducer(s, { type: 'RESPONDER_PERGUNTA', indice: 0, tempoRestante: 1 })).toBe(s);
  });

  it('limita a 2 entrevistas por mês', () => {
    let s = novoJogo({ nome: 'T', partido: 'PVP', seed: 'limite' });
    for (let i = 0; i < 2; i++) {
      s = gameReducer(s, { type: 'INICIAR_ENTREVISTA' });
      s = gameReducer(s, { type: 'CONCLUIR_ENTREVISTA' });
      s = gameReducer(s, { type: 'FECHAR_RESUMO_ENTREVISTA' });
    }
    const antes = s;
    expect(gameReducer(s, { type: 'INICIAR_ENTREVISTA' })).toBe(antes);
  });
});
