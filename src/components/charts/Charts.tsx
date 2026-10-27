/* ============================================================
   Diagramme als Inline-SVG (keine Bibliothek).
   Regeln: Texte in Text-Farben (nicht Serienfarbe), dünne Balken
   mit 4px abgerundetem Ende, Werte direkt beschriftet,
   jedes Element mit <title>-Tooltip.
   ============================================================ */
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

const BRAND = '#2563eb';

export interface BarDatum {
  label: string;
  value: number;
  /** Tooltip-Text */
  title?: string;
}

/** Vertikales Säulendiagramm (eine Serie) */
export function BarChart({ data, height = 200, format = (v: number) => String(v), color = BRAND, className }: { data: BarDatum[]; height?: number; format?: (v: number) => string; color?: string; className?: string }) {
  const W = 560;
  const top = 26;
  const base = height - 26;
  const plot = base - top;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = Math.max(1, data.length);
  const slot = (W - 20) / n;
  const barW = Math.min(44, slot * 0.62);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className={cn('w-full text-muted', className)} role="img">
      {[0.5, 1].map((f) => (
        <line key={f} x1={10} x2={W - 10} y1={base - plot * f} y2={base - plot * f} className="stroke-line" strokeDasharray="3 4" />
      ))}
      <line x1={10} x2={W - 10} y1={base} y2={base} className="stroke-line" />
      {data.map((d, i) => {
        const x = 10 + slot * i + (slot - barW) / 2;
        const h = d.value <= 0 ? 2 : Math.max(5, (d.value / max) * plot);
        const y = base - h;
        const r = Math.min(4, h / 2);
        const path = d.value <= 0
          ? `M${x} ${base - 2}h${barW}v2h${-barW}Z`
          : `M${x} ${base}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + barW - r}Q${x + barW} ${y} ${x + barW} ${y + r}V${base}Z`;
        return (
          <g key={d.label + i} className="transition-opacity hover:opacity-80">
            <title>{d.title ?? `${d.label}: ${format(d.value)}`}</title>
            <path d={path} fill={color} />
            {d.value > 0 && (
              <text x={x + barW / 2} y={y - 7} textAnchor="middle" fontSize="11.5" fontWeight="600" className="fill-fg">
                {format(d.value)}
              </text>
            )}
            <text x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize="11.5" className="fill-current">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

/** Ring mit 2px-Lücken, Summe in der Mitte und Legende */
export function DonutChart({ data, centerLabel, size = 170 }: { data: DonutDatum[]; centerLabel: string; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const R = 70;
  const stroke = 22;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 180 180" width={size} height={size} role="img" className="shrink-0">
        <circle cx={90} cy={90} r={R} fill="none" strokeWidth={stroke} className="stroke-surface-2" />
        {total > 0 &&
          data.filter((d) => d.value > 0).map((d) => {
            const len = (d.value / total) * C;
            const gap = data.filter((x) => x.value > 0).length > 1 ? 2 : 0;
            const el = (
              <circle
                key={d.label}
                cx={90}
                cy={90}
                r={R}
                fill="none"
                stroke={d.color}
                strokeWidth={stroke}
                strokeDasharray={`${Math.max(0, len - gap)} ${C - Math.max(0, len - gap)}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 90 90)"
              >
                <title>{`${d.label}: ${d.value}`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
        <text x={90} y={88} textAnchor="middle" fontSize="28" fontWeight="700" className="fill-fg">
          {total}
        </text>
        <text x={90} y={108} textAnchor="middle" fontSize="11.5" className="fill-muted">
          {centerLabel}
        </text>
      </svg>
      <ul className="min-w-[140px] space-y-1.5 text-[13px]">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
            <span className="text-muted">{d.label}</span>
            <span className="ml-auto pl-3 font-semibold tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface HBarDatum {
  label: string;
  value: number;
  color?: string;
  to?: string;
  title?: string;
}

/** Horizontale Balkenliste mit Beschriftung links und Wert rechts */
export function HBarList({ data, format = (v: number) => String(v), labelWidth = 120 }: { data: HBarDatum[]; format?: (v: number) => string; labelWidth?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      {data.map((d) => {
        const row = (
          <div className="flex items-center gap-3 text-[13px]" title={d.title ?? `${d.label}: ${format(d.value)}`}>
            <span className="shrink-0 truncate text-muted" style={{ width: labelWidth }}>
              {d.label}
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
              <span className="block h-full rounded-full" style={{ width: `${d.value > 0 ? Math.max(2, (d.value / max) * 100) : 0}%`, background: d.color ?? BRAND }} />
            </span>
            <span className="w-16 shrink-0 text-right font-semibold tabular-nums">{format(d.value)}</span>
          </div>
        );
        return d.to ? (
          <Link key={d.label} to={d.to} className="block rounded-md hover:bg-surface-2/60">
            {row}
          </Link>
        ) : (
          <div key={d.label}>{row}</div>
        );
      })}
    </div>
  );
}
