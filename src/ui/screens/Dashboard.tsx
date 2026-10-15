import { ACOES } from '../../data/acoes';
import { AVATARES_JOGADOR, AVATAR_RIVAL } from '../../data/avatares';
import { BALANCE } from '../../data/balance';
import { CIDADE, PARTIDOS } from '../../data/cidade';
import { TEMAS } from '../../data/temas';
import { bloqueioAcao, TEXTO_BLOQUEIO } from '../../engine/actions';
import { participacaoEsperada, pontosCampanha } from '../../engine/election';
import { formatarDinheiro, ROTULO_RECURSO } from '../../engine/resources';
import type { AcaoMensal, GameState, ResourceKey } from '../../engine/types';
import { Avatar } from '../components/Avatar';
import { Meter } from '../components/Meter';
import { useJogo } from '../GameProvider';
import { InterviewSummaryModal } from './InterviewSummaryModal';
import { ReportModal } from './ReportModal';

const ICONE_RECURSO: Record<ResourceKey, string> = {
  dinheiro: '💰',
  aprovacao: '👍',
  capitalPolitico: '🤝',
  midia: '📺',
  reputacao: '😇',
  riscoInvestigacao: '🕵️',
};

const milhar = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR')}k` : String(v));

function faixa(k: ResourceKey, [a, b]: [number, number]): string {
  if (k === 'dinheiro') return `+R$ ${milhar(a)}~${milhar(b)}`;
  return a === b ? `+${a}` : `+${a}~${b}`;
}

function humorJogador(s: GameState) {
  if (s.res.aprovacao >= 55) return 'feliz' as const;
  if (s.res.reputacao < 30 || s.res.aprovacao < 15) return 'triste' as const;
  return 'neutro' as const;
}

export function Dashboard({ onMenu }: { onMenu: () => void }) {
  const { jogo: s, dispatch } = useJogo();
  const partido = PARTIDOS.find((p) => p.sigla === s.jogador.partido) ?? PARTIDOS[0];
  const tema = TEMAS[s.pauta.tema];
  const mesesAte = s.mesEleicao - s.mes;
  const pesquisa = participacaoEsperada(
    { aprovacao: s.res.aprovacao, midia: s.res.midia, reputacao: s.res.reputacao, campanha: pontosCampanha(s.res.dinheiro) },
    { aprovacao: s.rival.aprovacao, midia: s.rival.midia, reputacao: s.rival.reputacao, campanha: BALANCE.eleicao.campanhaRival },
  );
  const pctJogador = Math.round(pesquisa * 100);

  const agir = (a: AcaoMensal) => {
    if (a.especial === 'entrevista') dispatch({ type: 'INICIAR_ENTREVISTA' });
    else dispatch({ type: 'ACAO', acaoId: a.id });
  };

  return (
    <div className="dashboard">
      <header className="topo card">
        <div className="topo-esq">
          <span className="logo-mini">ASCENSÃO</span>
          <span className="chip">📍 {CIDADE.nome}</span>
        </div>
        <div className="calendario">
          <span className="mes-num">Mês {s.mes}</span>
          <span className={`contagem ${mesesAte === 0 ? 'urgente' : ''}`}>
            {mesesAte === 0 ? '🗳️ Eleição no fim deste mês!' : `🗳️ Eleição em ${mesesAte} ${mesesAte === 1 ? 'mês' : 'meses'}`}
          </span>
        </div>
        <button className="btn btn-pequeno" onClick={onMenu}>
          ☰ Menu
        </button>
      </header>

      <div className="grade">
        {/* Coluna do jogador */}
        <aside className="col col-jogador">
          <section className="card perfil">
            <Avatar ap={AVATARES_JOGADOR[s.jogador.avatar] ?? AVATARES_JOGADOR[0]} humor={humorJogador(s)} size={110} fundo="#8fd3ff" />
            <div>
              <h2>{s.jogador.nome}</h2>
              <span className="chip" style={{ background: partido.cor }}>
                {partido.sigla}
              </span>
              <p className="cargo">Vereador(a) suplente</p>
            </div>
          </section>

          <section className="card recursos">
            <div className="dinheiro">
              <span>💰 Dinheiro</span>
              <strong className={s.res.dinheiro < 0 ? 'negativo' : ''}>{formatarDinheiro(s.res.dinheiro)}</strong>
            </div>
            <div className="dinheiro">
              <span>🤝 Capital político</span>
              <strong>{Math.round(s.res.capitalPolitico)}</strong>
            </div>
            <Meter rotulo="Aprovação" icone="👍" valor={s.res.aprovacao} cor="#3ccf7a" dica="Decide a eleição." />
            <Meter rotulo="Mídia" icone="📺" valor={s.res.midia} cor="#4a8cff" dica="Como a imprensa te trata." />
            <Meter rotulo="Reputação" icone="😇" valor={s.res.reputacao} cor="#ffd23f" dica="Se chegar a zero, você é cassado." />
            {s.escandalos.length > 0 && (
              <p className="segredos wobble-lento" title="Mentiras e negócios escusos que ainda podem vir à tona.">
                🤫 Esqueletos no armário: <b>{s.escandalos.length}</b>
              </p>
            )}
          </section>
        </aside>

        {/* Centro: pauta e agenda */}
        <main className="col col-centro">
          <section className={`card jornal ${s.pauta.emCrise ? 'crise' : ''}`}>
            <div className="jornal-cab">
              <span>📰 Gazeta de {CIDADE.nome}</span>
              <span className="chip">
                {tema.icone} Pauta do mês: {tema.rotulo}
              </span>
            </div>
            {s.pauta.emCrise && <span className="selo-crise shake">🚨 CRISE!</span>}
            <h3 className="manchete">{s.pauta.manchete}</h3>
            <p className="dica-pauta">
              Perguntas sobre <b>{tema.rotulo.toLowerCase()}</b> valem mais nas entrevistas deste mês
              {s.pauta.emCrise ? ' e fugir delas pega muito mal.' : '.'}
            </p>
          </section>

          <section className="card agenda">
            <div className="agenda-cab">
              <h3>📅 Agenda do mês</h3>
              <div className="relogios" aria-label={`${s.acoesRestantes} ações restantes`}>
                {Array.from({ length: BALANCE.acoesPorMes }).map((_, i) => (
                  <span key={i} className={`relogio ${i < s.acoesRestantes ? 'cheio' : ''}`}>
                    ⏰
                  </span>
                ))}
              </div>
            </div>
            <div className="acoes">
              {ACOES.map((a) => {
                const bloq = bloqueioAcao(s, a);
                const usos = s.usoAcoesMes[a.id] ?? 0;
                return (
                  <button
                    key={a.id}
                    className={`acao ${a.especial ? 'acao-especial' : ''} ${a.suja ? 'acao-suja' : ''}`}
                    disabled={!!bloq}
                    onClick={() => agir(a)}
                  >
                    <span className="acao-icone">{a.icone}</span>
                    <span className="acao-nome">{a.nome}</span>
                    <span className="acao-desc">{a.descricao}</span>
                    <span className="acao-chips">
                      {a.custo?.dinheiro ? <span className="mini custo">-{formatarDinheiro(a.custo.dinheiro)}</span> : null}
                      {a.custo?.capitalPolitico ? <span className="mini custo">-{a.custo.capitalPolitico} 🤝</span> : null}
                      {(Object.keys(a.efeitos) as ResourceKey[]).map((k) =>
                        k === 'riscoInvestigacao' ? (
                          <span key={k} className="mini risco">
                            ❓ risco
                          </span>
                        ) : (
                          <span key={k} className="mini ganho" title={ROTULO_RECURSO[k]}>
                            {ICONE_RECURSO[k]} {faixa(k, a.efeitos[k]!)}
                          </span>
                        ),
                      )}
                      {a.especial && <span className="mini ganho">🎮 mini game</span>}
                      {a.maxPorMes > 1 && (
                        <span className="mini">
                          {usos}/{a.maxPorMes}
                        </span>
                      )}
                    </span>
                    {bloq && bloq !== 'jogo-parado' && <span className="acao-bloq">{TEXTO_BLOQUEIO[bloq]}</span>}
                  </button>
                );
              })}
            </div>
            <button className="btn btn-grande btn-laranja encerrar" onClick={() => dispatch({ type: 'ENCERRAR_MES' })}>
              {mesesAte === 0 ? 'Ir para a eleição 🗳️' : `Encerrar mês ${s.mes} ➜`}
            </button>
          </section>
        </main>

        {/* Coluna direita: rival e diário */}
        <aside className="col col-dir">
          <section className="card rival">
            <h3>🥊 Seu rival</h3>
            <div className="rival-linha">
              <Avatar ap={AVATAR_RIVAL} humor={pctJogador > 50 ? 'bravo' : 'feliz'} size={80} fundo="#ffb3b3" />
              <div>
                <strong>{s.rival.nome}</strong>
                <p className="mini-texto">{s.rival.partido}</p>
                <p className="mini-texto">20 anos de Câmara. Conhece todo mundo.</p>
              </div>
            </div>
            <div className="pesquisa">
              <p className="mini-texto">📊 Pesquisa de intenção de voto (margem ±5)</p>
              <div className="barra-pesquisa">
                <div className="lado-jogador" style={{ width: `${pctJogador}%`, background: partido.cor }}>
                  {pctJogador}%
                </div>
                <div className="lado-rival">{100 - pctJogador}%</div>
              </div>
              <div className="pesquisa-nomes">
                <span>Você</span>
                <span>{s.rival.nome.split(' ')[0]}</span>
              </div>
            </div>
          </section>

          <section className="card diario">
            <h3>📓 Diário</h3>
            <ul>
              {[...s.log]
                .reverse()
                .slice(0, 14)
                .map((l, i) => (
                  <li key={s.log.length - i} className={`log-${l.tipo}`}>
                    <span className="log-mes">M{l.mes}</span> {l.texto}
                  </li>
                ))}
            </ul>
          </section>
        </aside>
      </div>

      {s.ultimaEntrevista && <InterviewSummaryModal />}
      {s.relatorio && s.status === 'jogando' && <ReportModal />}
    </div>
  );
}
