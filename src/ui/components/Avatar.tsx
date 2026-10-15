import type { AparenciaAvatar } from '../../engine/types';

export type Humor = 'feliz' | 'neutro' | 'bravo' | 'triste' | 'surpreso';

const INK = '#1d1630';

interface Props {
  ap: AparenciaAvatar;
  humor?: Humor;
  size?: number;
  fundo?: string;
  className?: string;
}

/** Personagem cartoon desenhado em SVG puro (sem assets externos). */
export function Avatar({ ap, humor = 'neutro', size = 96, fundo, className }: Props) {
  const tem = (a: AparenciaAvatar['acessorios'][number]) => ap.acessorios.includes(a);
  const sw = 3;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-hidden="true"
      style={{ overflow: 'visible' }}
    >
      {fundo && <circle cx="60" cy="60" r="58" fill={fundo} stroke={INK} strokeWidth={sw} />}

      {/* Cabelo de trás */}
      {ap.estiloCabelo === 'longo' && (
        <path d="M30 52 C26 18 94 18 90 52 L95 100 C82 106 38 106 25 100 Z" fill={ap.cabelo} stroke={INK} strokeWidth={sw} />
      )}

      {/* Corpo */}
      <path d="M16 122 C16 94 36 84 60 84 C84 84 104 94 104 122 Z" fill={ap.roupa} stroke={INK} strokeWidth={sw} />
      <rect x="52" y="70" width="16" height="18" rx="4" fill={ap.pele} stroke={INK} strokeWidth={sw} />
      {tem('gravata') && (
        <>
          <path d="M47 86 L60 92 L73 86 L68 84 L60 88 L52 84 Z" fill="#fff" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
          <path d="M60 90 L55 96 L60 118 L65 96 Z" fill="#ff5d5d" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        </>
      )}
      {tem('colar') && (
        <g fill="#fff" stroke={INK} strokeWidth={1.5}>
          {[44, 50, 56, 62, 68, 74].map((x, i) => (
            <circle key={x} cx={x + 1} cy={92 + Math.sin((i / 5) * Math.PI) * 6} r="2.8" />
          ))}
        </g>
      )}

      {/* Orelhas */}
      <circle cx="34" cy="56" r="7" fill={ap.pele} stroke={INK} strokeWidth={sw} />
      <circle cx="86" cy="56" r="7" fill={ap.pele} stroke={INK} strokeWidth={sw} />
      {tem('brinco') && (
        <>
          <circle cx="33" cy="66" r="3.5" fill="#ffd23f" stroke={INK} strokeWidth={2} />
          <circle cx="87" cy="66" r="3.5" fill="#ffd23f" stroke={INK} strokeWidth={2} />
        </>
      )}

      {/* Cabeça */}
      <ellipse cx="60" cy="52" rx="27" ry="30" fill={ap.pele} stroke={INK} strokeWidth={sw} />

      {/* Cabelo da frente */}
      <Cabelo estilo={ap.estiloCabelo} cor={ap.cabelo} />

      {/* Bochechas */}
      <circle cx="44" cy="64" r="5" fill="#ff7e7e" opacity="0.35" />
      <circle cx="76" cy="64" r="5" fill="#ff7e7e" opacity="0.35" />

      <Rosto humor={humor} />

      {tem('oculos') && (
        <g fill="rgba(255,255,255,0.25)" stroke={INK} strokeWidth={2.5}>
          <circle cx="49" cy="52" r="9" />
          <circle cx="71" cy="52" r="9" />
          <path d="M58 51 Q60 48 62 51" fill="none" />
        </g>
      )}
      {tem('bigode') && (
        <path
          d="M46 67 Q52 59 60 64 Q68 59 74 67 Q67 70 60 67 Q53 70 46 67 Z"
          fill={ap.cabelo}
          stroke={INK}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      )}
      {tem('microfone') && (
        <g transform="translate(86 74) rotate(-20)">
          <rect x="-4" y="6" width="8" height="30" rx="3" fill="#2b2b2b" stroke={INK} strokeWidth={2.5} />
          <rect x="-7" y="4" width="14" height="8" rx="2" fill="#ff5d5d" stroke={INK} strokeWidth={2.5} />
          <circle cx="0" cy="-3" r="9" fill="#9a9aa8" stroke={INK} strokeWidth={2.5} />
          <path d="M-6 -6 L6 -6 M-7 -1 L7 -1" stroke={INK} strokeWidth={1.2} />
        </g>
      )}
    </svg>
  );
}

function Cabelo({ estilo, cor }: { estilo: AparenciaAvatar['estiloCabelo']; cor: string }) {
  const p = { fill: cor, stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const };
  switch (estilo) {
    case 'curto':
      return <path d="M33 50 C30 22 48 20 60 20 C76 20 92 26 87 50 C82 38 74 33 60 34 C46 34 38 40 33 50 Z" {...p} />;
    case 'topete':
      return (
        <>
          <path d="M33 50 C30 24 48 22 60 22 C76 22 92 28 87 50 C82 38 74 34 60 35 C46 35 38 40 33 50 Z" {...p} />
          <path d="M42 30 C44 6 82 4 86 24 C76 16 64 18 58 30 Z" {...p} />
        </>
      );
    case 'careca':
      return (
        <>
          <path d="M33 50 C30 40 33 34 39 34 L39 52 Z" {...p} />
          <path d="M87 50 C90 40 87 34 81 34 L81 52 Z" {...p} />
          <ellipse cx="52" cy="30" rx="8" ry="4" fill="#fff" opacity="0.5" />
        </>
      );
    case 'coque':
      return (
        <>
          <circle cx="60" cy="18" r="11" {...p} />
          <path d="M33 54 C29 22 91 22 87 54 C80 34 40 34 33 54 Z" {...p} />
        </>
      );
    case 'longo':
      return <path d="M33 52 C32 24 88 24 87 52 C78 36 64 34 52 40 C44 44 38 48 33 52 Z" {...p} />;
    case 'cacheado':
      return (
        <g {...p}>
          {[
            [36, 40],
            [40, 28],
            [50, 21],
            [62, 19],
            [74, 22],
            [83, 30],
            [86, 42],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="10" />
          ))}
        </g>
      );
  }
}

function Rosto({ humor }: { humor: Humor }) {
  const ink = { stroke: INK, strokeWidth: 3, strokeLinecap: 'round' as const, fill: 'none' };
  const olhoR = humor === 'surpreso' ? 7.5 : 6;
  const sobrancelhas: Record<Humor, string> = {
    feliz: 'M42 40 Q48 36 54 40 M66 40 Q72 36 78 40',
    neutro: 'M43 40 L54 40 M66 40 L77 40',
    bravo: 'M42 37 L54 42 M66 42 L78 37',
    triste: 'M42 42 L54 38 M66 38 L78 42',
    surpreso: 'M42 36 Q48 31 54 36 M66 36 Q72 31 78 36',
  };
  return (
    <g>
      <path d={sobrancelhas[humor]} {...ink} />
      <ellipse cx="49" cy="52" rx={olhoR - 1} ry={olhoR} fill="#fff" stroke={INK} strokeWidth={2.5} />
      <ellipse cx="71" cy="52" rx={olhoR - 1} ry={olhoR} fill="#fff" stroke={INK} strokeWidth={2.5} />
      <circle cx="50" cy="53" r="2.8" fill={INK} />
      <circle cx="72" cy="53" r="2.8" fill={INK} />
      <path d="M60 56 Q64 62 59 63" {...ink} strokeWidth={2.5} />
      {humor === 'feliz' && <path d="M48 67 Q60 80 72 67 Z" fill="#7a2e3a" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />}
      {humor === 'neutro' && <path d="M52 70 Q60 72 68 70" {...ink} />}
      {humor === 'triste' && <path d="M50 74 Q60 65 70 74" {...ink} />}
      {humor === 'bravo' && (
        <path d="M49 73 Q60 66 71 73 L71 75 L49 75 Z" fill="#fff" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      )}
      {humor === 'surpreso' && <ellipse cx="60" cy="71" rx="5" ry="6.5" fill="#7a2e3a" stroke={INK} strokeWidth={2.5} />}
    </g>
  );
}
