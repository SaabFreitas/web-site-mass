import { CIDADE } from '../../data/cidade';
import { TEMAS } from '../../data/temas';
import { Modal } from '../components/Modal';
import { useJogo } from '../GameProvider';

export function ReportModal() {
  const { jogo: s, dispatch } = useJogo();
  const r = s.relatorio!;
  const tema = TEMAS[s.pauta.tema];
  return (
    <Modal className="relatorio">
      <div className="jornal-cab">
        <span>📰 Gazeta de {CIDADE.nome}</span>
        <span>Balanço do mês {r.mes}</span>
      </div>
      {r.manchetes.length > 0 && (
        <div className="bomba shake">
          {r.manchetes.map((m) => (
            <h2 key={m}>💣 {m}</h2>
          ))}
        </div>
      )}
      <table className="tabela-relatorio">
        <tbody>
          {r.linhas
            .filter((l) => l.rotulo !== 'Escândalo!')
            .map((l, i) => (
              <tr key={i} className={`linha-${l.tipo}`}>
                <td>{l.rotulo}</td>
                <td>{l.valor}</td>
              </tr>
            ))}
        </tbody>
      </table>
      <div className={`proxima-pauta ${s.pauta.emCrise ? 'crise' : ''}`}>
        <span className="mini-texto">Manchete do mês {s.mes}:</span>
        <strong>
          {tema.icone} {s.pauta.manchete}
        </strong>
      </div>
      <button className="btn btn-grande btn-verde" autoFocus onClick={() => dispatch({ type: 'FECHAR_RELATORIO' })}>
        Começar o mês {s.mes} ➜
      </button>
    </Modal>
  );
}
