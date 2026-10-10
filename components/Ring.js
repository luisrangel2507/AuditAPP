// Anillo de progreso (SVG). Color vía clase: good | mid | bad | (neutro)
export default function Ring({ value, size = 56, stroke = 6, cls = '', label, sub }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className={`ring ${cls}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity=".16" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="ring-in"><b>{label ?? `${Math.round(v)}`}</b>{sub && <small>{sub}</small>}</div>
    </div>
  );
}
