import { BALANCE } from '../data/balance';
import { CIDADE } from '../data/cidade';
import { JORNALISTAS, MATRIZ_TOM, getJornalista } from '../data/jornalistas';
import { PERGUNTAS, getPergunta } from '../data/perguntas';
import { aplicarDeltas, registrar } from './resources';
import type { Rng } from './rng';
import { criarEscandalo } from './scandals';
import type {
  Cidade,
  EntrevistaAtiva,
  GameState,
  Pauta,
  PerfilJornalista,
  PontuacaoResposta,
  RespostaJogador,
  ResumoEntrevista,
  Tema,
  Tom,
} from './types';

export interface ContextoResposta {
  perfil: PerfilJornalista;
  temaPergunta: Tema;
  pauta: Pauta;
  cidade: Cidade;
  /** Combo acumulado antes desta resposta. */
  combo: number;
}

export interface EscolhaResposta {
  tom: Tom | null;
  mentira: boolean;
  tempoRestante: number;
}

export interface PontosResposta {
  aprovacao: number;
  midia: number;
  combo: number;
  bom: boolean;
}

const arred = (v: number) => Math.round(v * 10) / 10;

/** Multiplicador de combo: 1 no primeiro acerto, crescendo até o teto. */
export function multiplicadorCombo(combo: number): number {
  const e = BALANCE.entrevista;
  return Math.min(e.comboMax, 1 + e.comboPasso * Math.max(0, combo - 1));
}

/**
 * Pontua uma única resposta. Pura: perfil × tom × contexto (pauta, crise, região).
 */
export function pontuarResposta(ctx: ContextoResposta, escolha: EscolhaResposta): PontosResposta {
  const e = BALANCE.entrevista;
  if (escolha.tom === null) {
    return { aprovacao: e.tempoEsgotado.aprovacao, midia: e.tempoEsgotado.midia, combo: 0, bom: false };
  }
  const base = MATRIZ_TOM[ctx.perfil][escolha.tom];
  let aprov = base.aprovacao;
  let midia = base.midia;

  // Região: positivo é amplificado pela afinidade da cidade, negativo é atenuado.
  const af = ctx.cidade.afinidadeTom[escolha.tom];
  aprov = aprov >= 0 ? aprov * af : aprov / af;

  // Tema da pauta do mês pesa mais (para o bem e para o mal).
  if (ctx.temaPergunta === ctx.pauta.tema) {
    aprov *= e.multPauta;
    midia *= e.multPauta;
    if (ctx.pauta.emCrise && escolha.tom === 'evasiva') aprov += e.penalidadeEvasivaCrise;
  }

  if (escolha.mentira) {
    aprov += e.bonusMentira.aprovacao;
    midia += e.bonusMentira.midia;
  }

  if (aprov > 0 && escolha.tempoRestante >= e.limiteRapidez) aprov += e.bonusRapidez;

  const bom = aprov > 0;
  const combo = bom ? ctx.combo + 1 : 0;
  if (bom) aprov *= multiplicadorCombo(combo);

  return { aprovacao: arred(aprov), midia: arred(midia), combo, bom };
}

/** Pontua uma entrevista inteira a partir das respostas do jogador. */
export function pontuarEntrevista(
  jornalistaId: string,
  respostas: RespostaJogador[],
  pauta: Pauta,
  cidade: Cidade = CIDADE,
): ResumoEntrevista {
  const j = getJornalista(jornalistaId);
  let combo = 0;
  let melhorCombo = 0;
  let somaAprov = 0;
  let somaMidia = 0;
  let mentiras = 0;
  const linhas: PontuacaoResposta[] = [];

  for (const r of respostas) {
    const p = getPergunta(r.perguntaId);
    const escolhida = r.indice === null ? null : p.respostas[r.indice];
    const tom = escolhida ? escolhida.tom : null;
    const mentira = !!escolhida?.mentira;
    const pts = pontuarResposta(
      { perfil: j.perfil, temaPergunta: p.tema, pauta, cidade, combo },
      { tom, mentira, tempoRestante: r.tempoRestante },
    );
    combo = pts.combo;
    melhorCombo = Math.max(melhorCombo, combo);
    somaAprov += pts.aprovacao;
    somaMidia += pts.midia;
    if (mentira) mentiras++;
    linhas.push({
      perguntaId: p.id,
      tom,
      aprovacao: pts.aprovacao,
      midia: pts.midia,
      combo: pts.combo,
      mentira,
      tempoEsgotado: tom === null,
      reacao: j.reacoes[tom ?? 'tempo'],
      bom: pts.bom,
    });
  }

  return {
    jornalistaId,
    linhas,
    aprovacao: Math.round(somaAprov * BALANCE.entrevista.multAprovacao),
    midia: Math.round(somaMidia * BALANCE.entrevista.multMidia),
    melhorCombo,
    mentiras,
  };
}

/** Sorteia jornalista, perguntas (priorizando a pauta) e a ordem das respostas. */
export function sortearEntrevista(s: GameState, rng: Rng): EntrevistaAtiva {
  const n = BALANCE.perguntasPorEntrevista;
  let feitas = new Set(s.perguntasFeitas);
  let pool = PERGUNTAS.filter((p) => !feitas.has(p.id));
  if (pool.length < n) {
    s.perguntasFeitas = [];
    feitas = new Set();
    pool = [...PERGUNTAS];
  }
  const daPauta = rng.shuffle(pool.filter((p) => p.tema === s.pauta.tema)).slice(0, BALANCE.perguntasDaPauta);
  const resto = rng.shuffle(pool.filter((p) => !daPauta.includes(p))).slice(0, n - daPauta.length);
  const escolhidas = rng.shuffle([...daPauta, ...resto]);
  const jornalista = rng.pick(JORNALISTAS);
  return {
    jornalistaId: jornalista.id,
    perguntaIds: escolhidas.map((p) => p.id),
    ordens: escolhidas.map((p) => rng.shuffle(p.respostas.map((_, i) => i))),
    respostas: [],
  };
}

/** Grava a resposta da próxima pergunta pendente. Retorna false se não houver pergunta pendente. */
export function registrarResposta(s: GameState, indice: number | null, tempoRestante: number): boolean {
  const ativa = s.entrevista;
  if (!ativa || ativa.respostas.length >= ativa.perguntaIds.length) return false;
  const perguntaId = ativa.perguntaIds[ativa.respostas.length];
  const max = getPergunta(perguntaId).respostas.length;
  const valido = indice !== null && Number.isInteger(indice) && indice >= 0 && indice < max;
  ativa.respostas.push({
    perguntaId,
    indice: valido ? indice : null,
    tempoRestante: valido ? Math.min(BALANCE.tempoResposta, Math.max(0, tempoRestante)) : 0,
  });
  return true;
}

/**
 * Encerra a entrevista e aplica o resultado (mutável; chamado pelo reducer em uma cópia).
 * Perguntas sem resposta contam como tempo esgotado.
 */
export function concluirEntrevista(s: GameState): void {
  const ativa = s.entrevista;
  if (!ativa) return;
  const respostas = ativa.respostas;
  // Garante uma resposta por pergunta, na ordem sorteada; ausentes contam como tempo esgotado.
  const normalizadas: RespostaJogador[] = ativa.perguntaIds.map((id) => {
    const r = respostas.find((x) => x.perguntaId === id);
    const max = getPergunta(id).respostas.length;
    const indice = r && r.indice !== null && r.indice >= 0 && r.indice < max ? r.indice : null;
    return { perguntaId: id, indice, tempoRestante: r?.tempoRestante ?? 0 };
  });

  const resumo = pontuarEntrevista(ativa.jornalistaId, normalizadas, s.pauta);
  const j = getJornalista(ativa.jornalistaId);
  const aplicado = aplicarDeltas(s.res, { aprovacao: resumo.aprovacao, midia: resumo.midia });

  for (const r of normalizadas) {
    if (r.indice === null) continue;
    const resp = getPergunta(r.perguntaId).respostas[r.indice];
    if (resp.mentira) {
      // Jornalista hostil vai cavar mais fundo: escândalo mais grave.
      criarEscandalo(s, resp.mentira, j.perfil === 'hostil' ? 2 : 1);
    }
  }

  s.perguntasFeitas.push(...ativa.perguntaIds);
  s.stats.entrevistas++;
  s.stats.mentiras += resumo.mentiras;
  s.stats.melhorCombo = Math.max(s.stats.melhorCombo, resumo.melhorCombo);
  s.ultimaEntrevista = { ...resumo, aprovacao: aplicado.aprovacao ?? 0, midia: aplicado.midia ?? 0 };
  s.entrevista = null;

  const sinal = (v: number) => `${v > 0 ? '+' : ''}${v}`;
  registrar(
    s,
    `Entrevista com ${j.nome} (${j.veiculo}): ${sinal(aplicado.aprovacao ?? 0)} Aprovação, ${sinal(aplicado.midia ?? 0)} Mídia.`,
    (aplicado.aprovacao ?? 0) >= 0 ? 'bom' : 'ruim',
  );
}
