import { useState } from 'react';
import { AVATARES_JOGADOR } from '../../data/avatares';
import { CIDADE, PARTIDOS } from '../../data/cidade';
import { Avatar } from '../components/Avatar';
import { Skyline } from '../components/Skyline';
import { useGame } from '../GameProvider';

export function MenuScreen({ onJogar }: { onJogar: () => void }) {
  const { jogo, dispatch } = useGame();
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState('');
  const [partido, setPartido] = useState(PARTIDOS[0].sigla);
  const [avatar, setAvatar] = useState(0);
  const [seed, setSeed] = useState('');

  const podeContinuar = jogo && jogo.status !== 'fim';

  const comecar = () => {
    if (jogo && jogo.status !== 'fim' && !confirm('Começar um jogo novo apaga a partida salva. Continuar?')) return;
    dispatch({ type: 'NOVO_JOGO', opts: { nome, partido, avatar, seed } });
    onJogar();
  };

  return (
    <div className="menu">
      <header className="menu-hero">
        <h1 className="logo wobble">ASCENSÃO</h1>
        <p className="subtitulo">De vereador de cidade pequena a dono do mundo.</p>
        <Skyline height={130} />
      </header>

      {!criando ? (
        <div className="card menu-card pop">
          {podeContinuar && (
            <button className="btn btn-grande btn-verde" onClick={onJogar}>
              ▶ Continuar — {jogo!.jogador.nome}, mês {jogo!.mes}
            </button>
          )}
          <button className="btn btn-grande btn-amarelo" onClick={() => setCriando(true)}>
            ✨ Novo jogo
          </button>
          <div className="como-jogar">
            <h3>Como jogar</h3>
            <ul>
              <li>Cada turno é um <b>mês</b>. Você tem poucas ações: escolha bem.</li>
              <li>
                <b>Aprovação</b> decide a eleição do <b>mês 6</b>. Mídia, reputação e dinheiro em caixa também ajudam.
              </li>
              <li>
                Nas <b>entrevistas</b>, leia o jornalista: cada um gosta de um tipo de resposta. Você tem 10 segundos.
              </li>
              <li>Mentir rende pontos agora... e escândalos depois. 🤫</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="card menu-card pop">
          <h2>Crie seu político</h2>
          <label className="campo">
            Nome
            <input value={nome} maxLength={28} placeholder="Ex.: Zé da Feira" onChange={(e) => setNome(e.target.value)} autoFocus />
          </label>

          <div className="campo">
            Visual
            <div className="avatar-picker">
              {AVATARES_JOGADOR.map((ap, i) => (
                <button key={i} className={`avatar-opcao ${avatar === i ? 'ativo' : ''}`} onClick={() => setAvatar(i)} aria-label={`Visual ${i + 1}`}>
                  <Avatar ap={ap} humor={avatar === i ? 'feliz' : 'neutro'} size={72} />
                </button>
              ))}
            </div>
          </div>

          <div className="campo">
            Partido
            <div className="partidos">
              {PARTIDOS.map((p) => (
                <button
                  key={p.sigla}
                  className={`partido ${partido === p.sigla ? 'ativo' : ''}`}
                  style={{ ['--cor' as string]: p.cor }}
                  onClick={() => setPartido(p.sigla)}
                >
                  <strong>{p.sigla}</strong>
                  <span>{p.nome}</span>
                </button>
              ))}
            </div>
          </div>

          <details className="avancado">
            <summary>Opções avançadas</summary>
            <label className="campo">
              Seed (para repetir uma partida)
              <input value={seed} placeholder="aleatória" onChange={(e) => setSeed(e.target.value)} />
            </label>
          </details>

          <p className="cidade-intro">
            📍 <b>{CIDADE.nome}</b>: {CIDADE.descricao}
          </p>

          <div className="linha-botoes">
            <button className="btn" onClick={() => setCriando(false)}>
              Voltar
            </button>
            <button className="btn btn-grande btn-verde" onClick={comecar}>
              Entrar na política! 🗳️
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
