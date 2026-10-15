import { getJornalista, ROTULO_TOM } from '../../data/jornalistas';
import { getPergunta } from '../../data/perguntas';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';
import { useJogo } from '../GameProvider';

const sinal = (v: number) => `${v > 0 ? '+' : ''}${v}`;

export function InterviewSummaryModal() {
  const { jogo: s, dispatch } = useJogo();
  const r = s.ultimaEntrevista!;
  const j = getJornalista(r.jornalistaId);
  const bom = r.aprovacao > 0;
  return (
    <Modal className="resumo-entrevista">
      <div className="resumo-topo">
        <Avatar ap={j.aparencia} humor={bom ? 'feliz' : r.aprovacao < 0 ? 'bravo' : 'neutro'} size={90} fundo="#ffe9a8" />
        <div>
          <h2>{bom ? 'Mandou bem!' : r.aprovacao < 0 ? 'Que vexame...' : 'Nem fede nem cheira.'}</h2>
          <p className="mini-texto">
            Entrevista com {j.nome} · {j.veiculo}
          </p>
        </div>
      </div>
      <div className="placar">
        <div className={`placar-item ${r.aprovacao >= 0 ? 'bom' : 'ruim'}`}>
          <span>👍 Aprovação</span>
          <strong>{sinal(r.aprovacao)}</strong>
        </div>
        <div className={`placar-item ${r.midia >= 0 ? 'bom' : 'ruim'}`}>
          <span>📺 Mídia</span>
          <strong>{sinal(r.midia)}</strong>
        </div>
        <div className="placar-item">
          <span>🔥 Melhor combo</span>
          <strong>x{r.melhorCombo}</strong>
        </div>
      </div>
      <ol className="lista-respostas">
        {r.linhas.map((l) => (
          <li key={l.perguntaId} className={l.bom ? 'bom' : 'ruim'}>
            <span className="pergunta-curta">{getPergunta(l.perguntaId).texto}</span>
            <span className="tags">
              {l.tom ? <span className={`tag tom-${l.tom}`}>{ROTULO_TOM[l.tom]}</span> : <span className="tag">⏱️ Tempo!</span>}
              {l.mentira && <span className="tag tag-mentira">🤥 Mentira</span>}
            </span>
          </li>
        ))}
      </ol>
      {r.mentiras > 0 && (
        <p className="aviso">
          🤫 Você mentiu {r.mentiras} {r.mentiras === 1 ? 'vez' : 'vezes'}. Isso pode explodir num mês qualquer...
        </p>
      )}
      <button className="btn btn-grande btn-verde" autoFocus onClick={() => dispatch({ type: 'FECHAR_RESUMO_ENTREVISTA' })}>
        Voltar ao gabinete
      </button>
    </Modal>
  );
}
