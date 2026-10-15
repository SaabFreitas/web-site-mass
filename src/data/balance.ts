/** Números de balanceamento centralizados. Ajuste aqui sem mexer na lógica. */
export const BALANCE = {
  acoesPorMes: 4,
  mesEleicao: 6,
  entrevistasPorMes: 2,
  perguntasPorEntrevista: 5,
  perguntasDaPauta: 2,
  tempoResposta: 10,

  inicio: {
    dinheiro: 5000,
    aprovacao: 22,
    capitalPolitico: 8,
    midia: 45,
    reputacao: 80,
    riscoInvestigacao: 0,
  },

  economia: {
    salario: 4000,
    despesasGabinete: 2600,
    jurosDivida: 0.05,
    limiteDivida: -10000,
  },

  mensal: {
    capitalPolitico: 1,
    /** Aprovação acima deste valor "esfria" a cada mês. */
    aprovacaoBase: 30,
    decaimentoAprovacao: 0.15,
    midiaBase: 50,
    driftMidia: 0.1,
    decaimentoRisco: 2,
  },

  /** Ganhos de aprovação perdem força conforme ela sobe. */
  retornoDecrescente: { referencia: 100, divisor: 75, minimo: 0.3, maximo: 1.1 },

  pautaChanceCrise: 0.3,

  entrevista: {
    multAprovacao: 0.45,
    multMidia: 1.1,
    multPauta: 1.5,
    penalidadeEvasivaCrise: -1,
    bonusMentira: { aprovacao: 1.5, midia: 1 },
    bonusRapidez: 0.5,
    limiteRapidez: 6,
    tempoEsgotado: { aprovacao: -2, midia: -2 },
    comboPasso: 0.2,
    comboMax: 1.8,
  },

  escandalo: {
    chanceBase: 0.08,
    chancePorGravidade: 0.05,
    chancePorMes: 0.02,
    chancePorRisco: 1 / 400,
    impacto: { aprovacao: -4, reputacao: -7, midia: -3 },
  },

  rival: {
    aprovacaoInicial: 41,
    midiaInicial: 50,
    reputacaoInicial: 70,
    driftAprovacao: [-1, 3] as [number, number],
    driftMidia: [-2, 2] as [number, number],
  },

  eleicao: {
    pesoMidia: 0.2,
    pesoReputacao: 0.1,
    /** A cada X reais em caixa, +1 ponto de campanha (até o teto). */
    reaisPorPontoCampanha: 1500,
    tetoCampanha: 10,
    campanhaRival: 6,
    ruido: 0.05,
    comparecimento: [0.72, 0.82] as [number, number],
    brancosNulos: [0.05, 0.1] as [number, number],
  },
} as const;
