import { useEffect, useState } from 'react';
import { AVATARES_JOGADOR, AVATAR_RIVAL } from '../../data/avatares';
import { CIDADE, PARTIDOS } from '../../data/cidade';
import { Avatar } from '../components/Avatar';
import { useJogo } from '../GameProvider';

const DURACAO = 7000;

export function ElectionScreen() {
  const { jogo: s, dispatch } = useJogo();
  const e = s.eleicao!;
  const [p, setP] = useState(0);
  const partido = PARTIDOS.find((x) => x.sigla === s.jogador.partido) ?? PARTIDOS[0];

  useEffect(() => {
    const inicio = performance.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (performance.now() - inicio) / DURACAO);
      setP(t);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Apuração com suspense: as urnas oscilam no começo e convergem para o resultado.
  const apurado = Math.pow(p, 0.8);
  const oscil = (1 - p) * 0.12 * Math.sin(p * 18 + (e.votosJogador % 7));
  const shareFinal = e.votosJogador / (e.votosJogador + e.votosRival);
  const shareAgora = Math.min(0.97, Math.max(0.03, shareFinal + oscil));
  const validosAgora = (e.votosJogador + e.votosRival) * apurado;
  const vj = Math.round(validosAgora * shareAgora);
  const vr = Math.round(validosAgora - vj);
  const pj = validosAgora > 0 ? (vj / validosAgora) * 100 : 50;
  const terminou = p >= 1;
  const jogadorNaFrente = vj >= vr;

  return (
    <div className="eleicao">
      <div className="card apuracao pop">
        <h1 className="titulo-eleicao">🗳️ Apuração — {CIDADE.nome}</h1>
        <p className="mini-texto">
          {e.cargo} · {Math.round(apurado * 100)}% das urnas apuradas
        </p>
        <div className="urna-progresso">
          <div style={{ width: `${apurado * 100}%` }} />
        </div>

        <div className="duelo">
          <div className={`candidato ${terminou && e.venceu ? 'vencedor' : ''}`}>
            <Avatar
              ap={AVATARES_JOGADOR[s.jogador.avatar] ?? AVATARES_JOGADOR[0]}
              humor={terminou ? (e.venceu ? 'feliz' : 'triste') : jogadorNaFrente ? 'feliz' : 'surpreso'}
              size={130}
              fundo="#8fd3ff"
            />
            <strong>{s.jogador.nome}</strong>
            <span className="votos">{vj.toLocaleString('pt-BR')} votos</span>
            <span className="pct">{pj.toFixed(1)}%</span>
          </div>
          <span className="vs">VS</span>
          <div className={`candidato ${terminou && !e.venceu ? 'vencedor' : ''}`}>
            <Avatar
              ap={AVATAR_RIVAL}
              humor={terminou ? (e.venceu ? 'bravo' : 'feliz') : jogadorNaFrente ? 'surpreso' : 'feliz'}
              size={130}
              fundo="#ffb3b3"
            />
            <strong>{s.rival.nome}</strong>
            <span className="votos">{vr.toLocaleString('pt-BR')} votos</span>
            <span className="pct">{(100 - pj).toFixed(1)}%</span>
          </div>
        </div>

        <div className="barra-pesquisa grande">
          <div className="lado-jogador" style={{ width: `${pj}%`, background: partido.cor }} />
          <div className="lado-rival" />
        </div>

        {terminou ? (
          <div className="resultado pop">
            <h2 className={e.venceu ? 'texto-vitoria' : 'texto-derrota'}>{e.venceu ? 'VOCÊ FOI ELEITO(A)!' : 'Não foi dessa vez...'}</h2>
            <p className="mini-texto">
              Comparecimento: {e.comparecimento.toLocaleString('pt-BR')} de {e.eleitores.toLocaleString('pt-BR')} eleitores ·
              Brancos e nulos: {e.brancosNulos.toLocaleString('pt-BR')}
            </p>
            <button className="btn btn-grande btn-verde" autoFocus onClick={() => dispatch({ type: 'FINALIZAR_ELEICAO' })}>
              Continuar ➜
            </button>
          </div>
        ) : (
          <button className="btn btn-pequeno pular" onClick={() => setP(1)}>
            Pular apuração ⏩
          </button>
        )}
      </div>
    </div>
  );
}
