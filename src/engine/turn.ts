import { BALANCE } from '../data/balance';
import { CIDADE } from '../data/cidade';
import { balancoMensal } from './economy';
import { calcularEleicao, pontosCampanha } from './election';
import { aplicarDeltas, clamp, registrar } from './resources';
import type { Rng } from './rng';
import { checarEscandalos } from './scandals';
import { sortearPauta } from './state';
import type { GameState, LinhaRelatorio } from './types';

const sinal = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 10) / 10}`;

/** Fecha o mês: finanças, decaimentos, escândalos, rival, nova pauta e eleição. */
export function fecharMes(s: GameState, rng: Rng): void {
  const m = BALANCE.mensal;
  const linhas: LinhaRelatorio[] = [];
  const mesFechado = s.mes;

  // 1. Finanças
  const fin = balancoMensal(s.res);
  linhas.push(...fin.linhas);
  aplicarDeltas(s.res, { dinheiro: fin.delta });

  // 2. Decaimentos naturais
  const decAprov = s.res.aprovacao > m.aprovacaoBase ? -(s.res.aprovacao - m.aprovacaoBase) * m.decaimentoAprovacao : 0;
  const driftMidia = (m.midiaBase - s.res.midia) * m.driftMidia;
  const aplicado = aplicarDeltas(s.res, {
    aprovacao: decAprov,
    midia: driftMidia,
    capitalPolitico: m.capitalPolitico,
    riscoInvestigacao: -m.decaimentoRisco,
  });
  if (aplicado.aprovacao) linhas.push({ rotulo: 'Memória curta do eleitor', valor: `${sinal(aplicado.aprovacao)} Aprovação`, tipo: 'ruim' });
  if (aplicado.midia) linhas.push({ rotulo: 'Ciclo de notícias', valor: `${sinal(aplicado.midia)} Mídia`, tipo: aplicado.midia > 0 ? 'bom' : 'ruim' });
  if (aplicado.capitalPolitico) linhas.push({ rotulo: 'Articulação na Câmara', valor: `${sinal(aplicado.capitalPolitico)} Capital`, tipo: 'bom' });

  // 3. Escândalos
  const manchetes = checarEscandalos(s, rng);
  for (const h of manchetes) linhas.push({ rotulo: 'Escândalo!', valor: h, tipo: 'ruim' });

  // 4. Rival (IA simples nesta fase)
  const r = BALANCE.rival;
  const antesRival = s.rival.aprovacao;
  s.rival.aprovacao = clamp(s.rival.aprovacao + rng.int(r.driftAprovacao[0], r.driftAprovacao[1]), 0, 100);
  s.rival.midia = clamp(s.rival.midia + rng.int(r.driftMidia[0], r.driftMidia[1]), 0, 100);
  const dr = s.rival.aprovacao - antesRival;
  if (dr !== 0) {
    linhas.push({ rotulo: `${s.rival.nome}`, valor: `${sinal(dr)} Aprovação`, tipo: dr > 0 ? 'ruim' : 'bom' });
  }

  registrar(s, `Fim do mês ${mesFechado}.`, 'info');

  // 5. Eleição
  if (mesFechado >= s.mesEleicao) {
    s.eleicao = calcularEleicao(
      { aprovacao: s.res.aprovacao, midia: s.res.midia, reputacao: s.res.reputacao, campanha: pontosCampanha(s.res.dinheiro) },
      { aprovacao: s.rival.aprovacao, midia: s.rival.midia, reputacao: s.rival.reputacao, campanha: BALANCE.eleicao.campanhaRival },
      CIDADE.eleitores,
      rng,
    );
    s.status = 'eleicao';
    s.relatorio = { mes: mesFechado, linhas, manchetes };
    registrar(s, `Dia de eleição em ${CIDADE.nome}!`, 'alerta');
    return;
  }

  // 6. Novo mês
  s.mes++;
  s.acoesRestantes = BALANCE.acoesPorMes;
  s.usoAcoesMes = {};
  s.pauta = sortearPauta(rng, s.pauta.tema);
  s.relatorio = { mes: mesFechado, linhas, manchetes };
  registrar(s, `Mês ${s.mes}: ${s.pauta.manchete}`, s.pauta.emCrise ? 'alerta' : 'info');
}
