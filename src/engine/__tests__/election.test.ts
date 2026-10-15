import { describe, expect, it } from 'vitest';
import { calcularEleicao, participacaoEsperada, type Candidatura } from '../election';
import { Rng } from '../rng';

const rival: Candidatura = { aprovacao: 40, midia: 50, reputacao: 70, campanha: 6 };

describe('eleição', () => {
  it('votos somam o comparecimento', () => {
    const r = calcularEleicao({ aprovacao: 40, midia: 50, reputacao: 80, campanha: 5 }, rival, 48000, new Rng(1));
    expect(r.votosJogador + r.votosRival + r.brancosNulos).toBe(r.comparecimento);
    expect(r.comparecimento).toBeLessThanOrEqual(48000);
  });

  it('é determinística com a mesma seed', () => {
    const j: Candidatura = { aprovacao: 45, midia: 50, reputacao: 80, campanha: 5 };
    expect(calcularEleicao(j, rival, 48000, new Rng(9))).toEqual(calcularEleicao(j, rival, 48000, new Rng(9)));
  });

  it('é monotônica: mais aprovação nunca dá menos votos (mesma seed)', () => {
    for (let seed = 0; seed < 50; seed++) {
      let anterior = -1;
      for (let aprov = 0; aprov <= 100; aprov += 10) {
        const r = calcularEleicao({ aprovacao: aprov, midia: 50, reputacao: 80, campanha: 5 }, rival, 48000, new Rng(seed));
        expect(r.percentualJogador).toBeGreaterThanOrEqual(anterior);
        anterior = r.percentualJogador;
      }
    }
  });

  it('candidato muito mais forte vence; muito mais fraco perde', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(calcularEleicao({ aprovacao: 80, midia: 70, reputacao: 90, campanha: 10 }, rival, 48000, new Rng(seed)).venceu).toBe(true);
      expect(calcularEleicao({ aprovacao: 10, midia: 20, reputacao: 30, campanha: 0 }, rival, 48000, new Rng(seed)).venceu).toBe(false);
    }
  });

  it('participação esperada é 50% entre candidatos iguais', () => {
    expect(participacaoEsperada(rival, rival)).toBeCloseTo(0.5);
  });
});
