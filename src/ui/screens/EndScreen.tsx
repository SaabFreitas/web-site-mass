import { AVATARES_JOGADOR } from '../../data/avatares';
import { formatarDinheiro } from '../../engine/resources';
import { Avatar } from '../components/Avatar';
import { useJogo } from '../GameProvider';

const CONFETES = ['#ff5d5d', '#ffd23f', '#3ccf7a', '#4a8cff', '#ff7eb6', '#9b6bff'];

export function EndScreen({ onNovo }: { onNovo: () => void }) {
  const { jogo: s, dispatch } = useJogo();
  const fim = s.fim!;
  const st = s.stats;

  return (
    <div className="fim">
      {fim.vitoria && (
        <div className="confetes" aria-hidden="true">
          {Array.from({ length: 40 }).map((_, i) => (
            <span
              key={i}
              style={{
                left: `${(i * 37) % 100}%`,
                background: CONFETES[i % CONFETES.length],
                animationDelay: `${(i % 10) * 0.25}s`,
                animationDuration: `${2.5 + (i % 5) * 0.4}s`,
              }}
            />
          ))}
        </div>
      )}
      <div className={`card fim-card pop ${fim.vitoria ? 'vitoria' : 'derrota'}`}>
        <Avatar
          ap={AVATARES_JOGADOR[s.jogador.avatar] ?? AVATARES_JOGADOR[0]}
          humor={fim.vitoria ? 'feliz' : 'triste'}
          size={160}
          fundo={fim.vitoria ? '#ffd23f' : '#c9c9d6'}
          className={fim.vitoria ? 'pula' : ''}
        />
        <h1 className={fim.vitoria ? 'texto-vitoria' : 'texto-derrota'}>{fim.titulo}</h1>
        <p className="motivo">{fim.motivo}</p>

        <div className="stats">
          <div>
            <span>📅 Meses</span>
            <strong>{s.mes}</strong>
          </div>
          <div>
            <span>👍 Aprovação final</span>
            <strong>{Math.round(s.res.aprovacao)}</strong>
          </div>
          <div>
            <span>😇 Reputação</span>
            <strong>{Math.round(s.res.reputacao)}</strong>
          </div>
          <div>
            <span>💰 Caixa</span>
            <strong>{formatarDinheiro(s.res.dinheiro)}</strong>
          </div>
          <div>
            <span>🎤 Entrevistas</span>
            <strong>{st.entrevistas}</strong>
          </div>
          <div>
            <span>🔥 Melhor combo</span>
            <strong>x{st.melhorCombo}</strong>
          </div>
          <div>
            <span>🤥 Mentiras</span>
            <strong>{st.mentiras}</strong>
          </div>
          <div>
            <span>💣 Escândalos</span>
            <strong>{st.escandalosExplodidos}</strong>
          </div>
        </div>

        {fim.vitoria && <p className="em-breve">🚧 Próxima parada: o nível <b>Estado</b> chega na Fase 3!</p>}
        <p className="mini-texto">Seed da partida: {s.seed}</p>

        <button
          className="btn btn-grande btn-amarelo"
          onClick={() => {
            dispatch({ type: 'APAGAR_JOGO' });
            onNovo();
          }}
        >
          🔁 Jogar de novo
        </button>
      </div>
    </div>
  );
}
