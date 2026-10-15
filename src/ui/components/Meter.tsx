interface Props {
  rotulo: string;
  icone: string;
  valor: number;
  cor: string;
  dica?: string;
}

export function Meter({ rotulo, icone, valor, cor, dica }: Props) {
  const v = Math.max(0, Math.min(100, valor));
  return (
    <div className="meter" title={dica}>
      <div className="meter-top">
        <span>
          {icone} {rotulo}
        </span>
        <strong>{Math.round(v)}</strong>
      </div>
      <div className="meter-bar">
        <div className="meter-fill" style={{ width: `${v}%`, background: cor }} />
      </div>
    </div>
  );
}
