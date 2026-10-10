// Ilustración industrial (SVG) para el encabezado del login: tolva, máquina inyectora y pellets.
// Determinista (sin Math.random) para no romper la hidratación.
function rng(seed) { let s = seed; return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296); }

export function Pellets({ w = 300, h = 200, n = 90, seed = 7, id = 'p' }) {
  const r = rng(seed);
  const items = Array.from({ length: n }, () => ({ x: r() * w, y: r() * h, s: 7 + r() * 9, o: .55 + r() * .45 }));
  items.sort((a, b) => a.y - b.y);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}g`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ffffff" /><stop offset=".6" stopColor="#dfe7f6" /><stop offset="1" stopColor="#aebbd6" />
        </radialGradient>
      </defs>
      {items.map((p, i) => <ellipse key={i} cx={p.x} cy={p.y} rx={p.s} ry={p.s * .86} fill={`url(#${id}g)`} opacity={p.o} />)}
    </svg>
  );
}

export function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 400 300" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="hbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0a2459" /><stop offset=".6" stopColor="#14429b" /><stop offset="1" stopColor="#2a6bd6" /></linearGradient>
        <linearGradient id="metal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#9fb4d6" /><stop offset=".45" stopColor="#e8eef9" /><stop offset="1" stopColor="#7f97c2" /></linearGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity=".16" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" /></linearGradient>
        <radialGradient id="glow" cx="75%" cy="30%" r="60%"><stop offset="0" stopColor="#5b95ee" stopOpacity=".55" /><stop offset="1" stopColor="#5b95ee" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="400" height="300" fill="url(#hbg)" />
      <rect width="400" height="300" fill="url(#glow)" />
      {/* estructura de nave */}
      {[250, 295, 340, 385].map((x) => <rect key={x} x={x} y="0" width="9" height="300" fill="url(#beam)" />)}
      <rect x="230" y="40" width="170" height="5" fill="#fff" opacity=".12" /><rect x="230" y="92" width="170" height="5" fill="#fff" opacity=".08" />
      {/* tolva */}
      <path d="M300 0 h46 v58 l-14 34 h-18 l-14 -34 z" fill="url(#metal)" opacity=".95" />
      <rect x="314" y="92" width="18" height="26" fill="#7f97c2" />
      <rect x="296" y="116" width="54" height="14" rx="5" fill="#2150b4" />
      {/* máquina */}
      <rect x="258" y="134" width="132" height="64" rx="12" fill="#0b2a6b" opacity=".92" />
      <rect x="268" y="144" width="66" height="30" rx="8" fill="url(#metal)" opacity=".9" />
      <rect x="344" y="150" width="34" height="38" rx="8" fill="#e8741a" />
      <rect x="258" y="198" width="132" height="10" fill="#07204f" />
      {/* banda transportadora diagonal */}
      <path d="M170 300 L400 190 L400 214 L196 300 z" fill="#d8e2f4" opacity=".28" />
      <path d="M170 300 L400 190" stroke="#fff" strokeOpacity=".5" strokeWidth="2.5" />
      {/* destello azul */}
      <path d="M340 300 L400 232 L400 300 z" fill="#2f7bff" opacity=".85" />
    </svg>
  );
}
