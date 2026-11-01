// Small shared building blocks so every page uses the same neo-brutalist look.
import React from 'react';
import { legendBands, legendGradientCss, BAND_LABEL, pressureStyle } from '../utils/heatmapColors';

export const INK = '#121c1b';

export function Card({
  children,
  className = '',
  tone = 'white',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'white' | 'slate' | 'parchment' | 'teal' | 'carmine';
}) {
  const bg = {
    white: 'bg-white text-[#121c1b]',
    slate: 'bg-[#ebf6f4] text-[#121c1b]',
    parchment: 'bg-[#ede8dc] text-[#121c1b]',
    teal: 'bg-[#1d635d] text-white',
    carmine: 'bg-[#8b2635] text-[#f1fcf9]',
  }[tone];
  return <section className={`${bg} border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] p-3 sm:p-4 ${className}`}>{children}</section>;
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <Card tone="parchment" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 bg-[#1d635d] shrink-0" />
          <h1 className="font-bold uppercase tracking-tight text-sm sm:text-lg">{title}</h1>
        </div>
        {subtitle && <p className="text-[#3f4947] text-[11px] sm:text-xs mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </Card>
  );
}

export function Chip({
  children,
  tone = 'white',
  className = '',
  title,
}: {
  children: React.ReactNode;
  tone?: 'white' | 'ink' | 'teal' | 'mint' | 'carmine' | 'terracotta' | 'parchment';
  className?: string;
  title?: string;
}) {
  const bg = {
    white: 'bg-white text-[#121c1b]',
    ink: 'bg-[#121c1b] text-[#f1fcf9]',
    teal: 'bg-[#1d635d] text-white',
    mint: 'bg-[#adefe7] text-[#00201d]',
    carmine: 'bg-[#8b2635] text-white',
    terracotta: 'bg-[#d97757] text-white',
    parchment: 'bg-[#ede8dc] text-[#121c1b]',
  }[tone];
  return (
    <span
      title={title}
      className={`${bg} inline-flex items-center gap-1 px-2 py-0.5 border-[2px] border-[#121c1b] font-label-mono-sm uppercase font-bold text-[9px] sm:text-[10px] whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}

/** Rule from CLAUDE.md: any number not from a real device or the API is labelled SAMPLE DATA. */
export function SampleBadge({ why }: { why?: string }) {
  return (
    <Chip tone="terracotta" title={why ?? 'Not from a real device or the API'}>
      SAMPLE DATA
    </Chip>
  );
}

export function Button({
  children,
  onClick,
  tone = 'white',
  className = '',
  disabled,
  title,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: 'white' | 'teal' | 'carmine' | 'terracotta' | 'mint';
  className?: string;
  disabled?: boolean;
  title?: string;
  type?: 'button' | 'submit';
}) {
  const bg = {
    white: 'bg-white text-[#121c1b] hover:bg-[#ebf6f4]',
    teal: 'bg-[#1d635d] text-white hover:bg-[#121c1b]',
    carmine: 'bg-[#8b2635] text-white hover:bg-[#6c1c28]',
    terracotta: 'bg-[#d97757] text-white hover:bg-[#b85f42]',
    mint: 'bg-[#adefe7] text-[#00201d] hover:bg-[#a3cfc9]',
  }[tone];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${bg} min-h-[40px] px-3 py-2 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-label-mono-sm uppercase font-bold text-[11px] neo-btn cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

/** Gradient bar plus the four bands with their configured mmHg ranges. */
export function PressureLegend({ compact = false }: { compact?: boolean }) {
  return (
    <div className="w-full">
      <div className="w-full h-3.5 sm:h-4 border-[2px] border-[#121c1b]" style={{ background: legendGradientCss() }} />
      <div className={`grid grid-cols-4 mt-1 font-label-mono-sm font-bold ${compact ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'}`}>
        {legendBands().map((b, i) => (
          <div key={b.band} className={`flex flex-col ${i === 3 ? 'text-right text-[#8b2635]' : i === 0 ? 'text-left' : 'text-center'}`}>
            <span>{BAND_LABEL[b.band]}</span>
            <span className="text-[#3f4947] font-normal">{b.range} mmHg</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** One heatmap cell. Shows the number when asked, and always names the band in the tooltip. */
export function HeatCell({
  mmHg,
  showNumber,
  selected,
  onClick,
  label,
  small,
}: {
  mmHg: number;
  showNumber?: boolean;
  selected?: boolean;
  onClick?: () => void;
  label: string;
  small?: boolean;
}) {
  const s = pressureStyle(mmHg);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ backgroundColor: s.bg, color: s.textColor }}
      title={`${label}: ${s.mmHg} mmHg (${s.label})`}
      aria-label={`${label}: ${s.mmHg} mmHg, ${s.label}`}
      className={`relative aspect-square flex items-center justify-center border-[#121c1b] transition-colors duration-500 ${
        small ? 'border' : 'border-[1.5px] hover:z-10 hover:scale-110 transition-transform cursor-pointer'
      } ${selected ? 'ring-[3px] ring-[#121c1b] z-10 scale-105' : ''}`}
    >
      {s.isHot && !small && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-white border border-[#121c1b]" />}
      {showNumber && <span className="font-label-mono-sm font-extrabold leading-none text-[8px] sm:text-[10px]">{Math.round(s.mmHg)}</span>}
    </button>
  );
}

export function Stat({ label, value, sub, tone = 'ink' }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'ink' | 'teal' | 'carmine' }) {
  const color = { ink: 'text-[#121c1b]', teal: 'text-[#1d635d]', carmine: 'text-[#8b2635]' }[tone];
  return (
    <div className="bg-white border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] p-2.5 sm:p-3 min-w-0">
      <div className="font-label-mono-sm text-[9px] sm:text-[10px] text-[#3f4947] uppercase font-bold truncate">{label}</div>
      <div className={`font-bold text-base sm:text-lg mt-0.5 ${color}`}>{value}</div>
      {sub && <div className="text-[9px] sm:text-[10px] text-[#3f4947] mt-0.5 font-label-mono-sm truncate">{sub}</div>}
    </div>
  );
}

/** Small inline icons (no icon font to download, so they never show up as raw words). */
export function Icon({ name, size = 20 }: { name: 'monitor' | 'beds' | 'zones' | 'history' | 'mat'; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'square' as const, 'aria-hidden': true };
  switch (name) {
    case 'monitor':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" />
          <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
        </svg>
      );
    case 'beds':
      return (
        <svg {...common}>
          <path d="M3 6v13M3 14h18v5M21 14v-3a3 3 0 0 0-3-3h-7v6" />
          <rect x="5" y="9" width="4" height="3" />
        </svg>
      );
    case 'zones':
      return (
        <svg {...common}>
          <path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9" />
        </svg>
      );
    case 'history':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
      );
    case 'mat':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="12" height="12" />
          <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
        </svg>
      );
  }
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="border-[2px] border-dashed border-[#121c1b] bg-[#f1fcf9] p-4 text-center">
      <div className="font-label-mono-sm font-bold uppercase text-xs">{title}</div>
      {children && <div className="text-[11px] text-[#3f4947] mt-1">{children}</div>}
    </div>
  );
}
