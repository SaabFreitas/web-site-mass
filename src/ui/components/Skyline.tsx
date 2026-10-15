/** Paisagem cartoon da cidade (SVG inline). */
export function Skyline({ height = 110 }: { height?: number }) {
  const ink = '#1d1630';
  const predios = [
    { x: 10, w: 60, h: 55, c: '#ff9f43' },
    { x: 75, w: 45, h: 80, c: '#4a8cff' },
    { x: 125, w: 70, h: 45, c: '#3ccf7a' },
    { x: 320, w: 55, h: 70, c: '#ff7eb6' },
    { x: 380, w: 80, h: 50, c: '#ffd23f' },
    { x: 465, w: 50, h: 90, c: '#9b6bff' },
    { x: 520, w: 70, h: 60, c: '#ff5d5d' },
    { x: 595, w: 55, h: 42, c: '#4a8cff' },
  ];
  return (
    <svg className="skyline" viewBox="0 0 660 120" preserveAspectRatio="xMidYMax slice" height={height} width="100%" aria-hidden="true">
      <circle cx="600" cy="30" r="20" fill="#ffd23f" stroke={ink} strokeWidth="3" />
      <g fill="#fff" stroke={ink} strokeWidth="3">
        <path d="M60 30 q8 -14 22 -6 q12 -8 20 4 q10 2 6 10 h-50 q-8 -4 2 -8z" />
        <path d="M400 22 q8 -12 20 -5 q10 -6 18 4 q8 2 4 8 h-44 q-6 -3 2 -7z" />
      </g>
      {predios.map((p) => (
        <g key={p.x}>
          <rect x={p.x} y={118 - p.h} width={p.w} height={p.h} rx="4" fill={p.c} stroke={ink} strokeWidth="3" />
          {Array.from({ length: Math.floor((p.h - 14) / 18) }).map((_, r) =>
            Array.from({ length: Math.floor((p.w - 8) / 16) }).map((_, c) => (
              <rect
                key={`${r}-${c}`}
                x={p.x + 8 + c * 16}
                y={118 - p.h + 10 + r * 18}
                width="8"
                height="9"
                rx="1.5"
                fill="#fff8e7"
                stroke={ink}
                strokeWidth="2"
              />
            )),
          )}
        </g>
      ))}
      {/* Igreja / Câmara */}
      <g stroke={ink} strokeWidth="3" strokeLinejoin="round">
        <rect x="215" y="60" width="90" height="58" fill="#fff8e7" />
        <path d="M205 62 L260 34 L315 62 Z" fill="#ff5d5d" />
        <rect x="245" y="14" width="30" height="30" fill="#fff8e7" />
        <path d="M241 16 L260 0 L279 16 Z" fill="#4a8cff" />
        <circle cx="260" cy="29" r="7" fill="#ffd23f" />
        <path d="M250 118 v-26 q10 -12 20 0 v26" fill="#9b6bff" />
        <rect x="225" y="78" width="14" height="16" fill="#8fd3ff" />
        <rect x="281" y="78" width="14" height="16" fill="#8fd3ff" />
      </g>
      <rect x="0" y="116" width="660" height="6" fill={ink} />
    </svg>
  );
}
