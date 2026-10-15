import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BALANCE } from '../../data/balance';
import { CIDADE } from '../../data/cidade';
import { AVATARES_JOGADOR } from '../../data/avatares';
import { getJornalista, ROTULO_PERFIL, ROTULO_TOM } from '../../data/jornalistas';
import { getPergunta } from '../../data/perguntas';
import { TEMAS } from '../../data/temas';
import { multiplicadorCombo, pontuarEntrevista, pontuarResposta, type PontosResposta } from '../../engine/interview';
import type { Tom } from '../../engine/types';
import { Avatar, type Humor } from '../components/Avatar';
import { useJogo } from '../GameProvider';

type Fase = 'intro' | 'pergunta' | 'feedback';

interface Feedback {
  indice: number | null;
  tom: Tom | null;
  mentira: boolean;
  pts: PontosResposta;
  reacao: string;
}

const TEMPO = BALANCE.tempoResposta;

function humorDaReacao(f: Feedback | null): Humor {
  if (!f) return 'neutro';
  if (f.tom === null) return 'surpreso';
  if (f.pts.aprovacao >= 2) return 'feliz';
  if (f.pts.aprovacao > 0) return 'neutro';
  if (f.tom === 'agressiva') return 'bravo';
  return 'triste';
}

export function InterviewScreen() {
  const { jogo: s, dispatch } = useJogo();
  const ent = s.entrevista!;
  const j = getJornalista(ent.jornalistaId);
  const tema = TEMAS[s.pauta.tema];

  // As respostas ficam gravadas no estado do jogo: recarregar a página retoma de onde parou.
  const respondidas = ent.respostas.length;
  const total = ent.perguntaIds.length;
  const [fase, setFase] = useState<Fase>('intro');
  const [n, setN] = useState(Math.min(respondidas, total - 1));
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [restante, setRestante] = useState<number>(TEMPO);
  const prazo = useRef(0);

  // Combo e parcial derivados das respostas gravadas (mesma conta da engine).
  const parcial = useMemo(() => pontuarEntrevista(ent.jornalistaId, ent.respostas, s.pauta), [ent, s.pauta]);
  const combo = parcial.linhas.length ? parcial.linhas[parcial.linhas.length - 1].combo : 0;
  const totais = parcial.linhas.reduce((t, l) => ({ aprovacao: t.aprovacao + l.aprovacao, midia: t.midia + l.midia }), {
    aprovacao: 0,
    midia: 0,
  });

  const pergunta = getPergunta(ent.perguntaIds[n]);
  const ordem = ent.ordens[n];
  const ultima = n === total - 1;

  // Todas respondidas (ex.: recarregou na última tela): só falta encerrar.
  useEffect(() => {
    if (respondidas >= total && fase === 'intro') dispatch({ type: 'CONCLUIR_ENTREVISTA' });
  }, [respondidas, total, fase, dispatch]);

  const responder = useCallback(
    (indice: number | null) => {
      if (fase !== 'pergunta' || respondidas !== n) return;
      const tempoRestante = indice === null ? 0 : Math.max(0, (prazo.current - performance.now()) / 1000);
      const resp = indice === null ? null : pergunta.respostas[indice];
      const pts = pontuarResposta(
        { perfil: j.perfil, temaPergunta: pergunta.tema, pauta: s.pauta, cidade: CIDADE, combo },
        { tom: resp?.tom ?? null, mentira: !!resp?.mentira, tempoRestante },
      );
      dispatch({ type: 'RESPONDER_PERGUNTA', indice, tempoRestante });
      setFeedback({ indice, tom: resp?.tom ?? null, mentira: !!resp?.mentira, pts, reacao: j.reacoes[resp?.tom ?? 'tempo'] });
      setFase('feedback');
    },
    [fase, respondidas, n, pergunta, j, s.pauta, combo, dispatch],
  );

  const responderRef = useRef(responder);
  responderRef.current = responder;

  // Cronômetro
  useEffect(() => {
    if (fase !== 'pergunta') return;
    prazo.current = performance.now() + TEMPO * 1000;
    setRestante(TEMPO);
    const id = window.setInterval(() => {
      const r = (prazo.current - performance.now()) / 1000;
      if (r <= 0) {
        window.clearInterval(id);
        setRestante(0);
        responderRef.current(null);
      } else {
        setRestante(r);
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [fase, n]);

  const avancar = useCallback(() => {
    if (ultima) {
      dispatch({ type: 'CONCLUIR_ENTREVISTA' });
    } else {
      setN((x) => x + 1);
      setFeedback(null);
      setFase('pergunta');
    }
  }, [ultima, dispatch]);

  // Atalhos de teclado: 1-4 para responder, Enter/Espaço para avançar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (fase === 'pergunta') {
        const k = Number(e.key);
        if (k >= 1 && k <= ordem.length) responder(ordem[k - 1]);
      } else if (fase === 'feedback' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        avancar();
      } else if (fase === 'intro' && e.key === 'Enter') {
        setFase('pergunta');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fase, ordem, responder, avancar]);

  const pctTempo = (restante / TEMPO) * 100;
  const corTempo = restante > 6 ? '#3ccf7a' : restante > 3 ? '#ffd23f' : '#ff5d5d';
  const jogadorAp = AVATARES_JOGADOR[s.jogador.avatar] ?? AVATARES_JOGADOR[0];
  const sinal = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 10) / 10}`;

  const humorJogador: Humor = useMemo(() => {
    if (fase === 'pergunta') return restante < 3 ? 'surpreso' : 'neutro';
    if (fase === 'feedback' && feedback) return feedback.pts.bom ? 'feliz' : 'triste';
    return 'neutro';
  }, [fase, restante, feedback]);

  if (fase === 'intro') {
    return (
      <div className="entrevista">
        <div className="card intro-entrevista pop">
          <div className="estudio-luz" />
          <span className="ao-vivo">{respondidas > 0 ? '● VOLTANDO DO INTERVALO...' : '● AO VIVO EM 3, 2, 1...'}</span>
          <Avatar ap={j.aparencia} humor="neutro" size={150} fundo="#ffe9a8" className="flutua" />
          <h2>{j.nome}</h2>
          <p className="veiculo">{j.veiculo}</p>
          <span className={`chip perfil-${j.perfil}`}>Perfil: {ROTULO_PERFIL[j.perfil]}</span>
          <p>{j.descricao}</p>
          <div className="dica-box">💡 {j.dica}</div>
          <p className="mini-texto">
            {respondidas > 0 ? `Pergunta ${n + 1} de ${total}` : `${total} perguntas`} · {TEMPO}s para cada · pauta do mês: {tema.icone} {tema.rotulo}
            {s.pauta.emCrise ? ' (em crise!)' : ''}
          </p>
          <button className="btn btn-grande btn-vermelho" autoFocus onClick={() => setFase('pergunta')}>
            🎤 {respondidas > 0 ? 'Voltar ao ar!' : 'Entrar no ar!'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="entrevista">
      <div className="estudio card">
        <div className="estudio-topo">
          <span className="ao-vivo pisca">● AO VIVO</span>
          <span className="chip">
            {j.veiculo} · {ROTULO_PERFIL[j.perfil]}
          </span>
          <span className="chip">
            Pergunta {n + 1}/{ent.perguntaIds.length}
          </span>
          <span className={`combo ${combo >= 2 ? 'combo-ativo pop' : ''}`} key={combo}>
            🔥 Combo x{combo} {combo >= 2 && <small>({multiplicadorCombo(combo).toFixed(1)}×)</small>}
          </span>
        </div>

        <div className="palco">
          <div className="personagem">
            <Avatar ap={j.aparencia} humor={fase === 'feedback' ? humorDaReacao(feedback) : 'neutro'} size={130} fundo="#ffe9a8" />
            <span className="nome-tag">{j.nome}</span>
          </div>
          <div className="balao-area">
            {fase === 'pergunta' ? (
              <div className="balao pop" key={pergunta.id}>
                {pergunta.tema === s.pauta.tema && <span className="selo-pauta">{tema.icone} Pauta do mês</span>}
                <p>{pergunta.texto}</p>
              </div>
            ) : (
              <div className={`balao balao-reacao pop ${feedback?.pts.bom ? 'bom' : 'ruim'}`}>
                <p>{feedback?.reacao}</p>
              </div>
            )}
          </div>
          <div className="personagem personagem-jogador">
            <Avatar ap={jogadorAp} humor={humorJogador} size={110} fundo="#8fd3ff" />
            <span className="nome-tag">Você</span>
          </div>
        </div>

        {fase === 'pergunta' && (
          <>
            <div className="timer">
              <div className="timer-fill" style={{ width: `${pctTempo}%`, background: corTempo }} />
              <span className="timer-num">{Math.ceil(restante)}s</span>
            </div>
            <div className="respostas">
              {ordem.map((idx, k) => (
                <button key={idx} className="resposta" onClick={() => responder(idx)}>
                  <span className="tecla">{k + 1}</span>
                  {pergunta.respostas[idx].texto}
                </button>
              ))}
            </div>
          </>
        )}

        {fase === 'feedback' && feedback && (
          <div className="feedback pop">
            {feedback.indice !== null ? (
              <p className="sua-resposta">“{pergunta.respostas[feedback.indice].texto}”</p>
            ) : (
              <p className="sua-resposta">⏱️ Você travou e não respondeu a tempo!</p>
            )}
            <div className="tags">
              {feedback.tom && <span className={`tag tom-${feedback.tom}`}>Tom: {ROTULO_TOM[feedback.tom]}</span>}
              <span className={`tag ${feedback.pts.aprovacao >= 0 ? 'tag-bom' : 'tag-ruim'}`}>👍 {sinal(feedback.pts.aprovacao)}</span>
              <span className={`tag ${feedback.pts.midia >= 0 ? 'tag-bom' : 'tag-ruim'}`}>📺 {sinal(feedback.pts.midia)}</span>
              {feedback.pts.combo >= 2 && <span className="tag tag-combo">🔥 Combo x{feedback.pts.combo}!</span>}
              {feedback.mentira && <span className="tag tag-mentira shake">🤥 Mentira! Isso pode voltar para te assombrar...</span>}
            </div>
            <div className="parcial mini-texto">
              Parcial da entrevista: 👍 {sinal(totais.aprovacao)} · 📺 {sinal(totais.midia)} (antes dos ajustes finais)
            </div>
            <button className="btn btn-grande btn-verde" autoFocus onClick={avancar}>
              {ultima ? 'Encerrar entrevista 🎬' : 'Próxima pergunta ➜'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
