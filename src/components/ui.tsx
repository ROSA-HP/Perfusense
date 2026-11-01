// Shared building blocks. The look follows the PerfuSense poster: white cards with an ink
// border, section titles marked by a carmine square over a rule, deep-teal strip headers
// with a numbered box, mono caps chips.
import React from 'react';
import { legendBands, legendGradientCss, BAND_LABEL, pressureStyle } from '../utils/heatmapColors';

export const INK = '#121c1b';
export const DEEP_TEAL = '#174f4a'; // poster strip headers and table heads (a shade under Surgical Teal)

/** Poster section title: carmine square, bold heading, rule underneath. */
export function SectionTitle({ children, action, as: Tag = 'h2' }: { children: React.ReactNode; action?: React.ReactNode; as?: 'h1' | 'h2' }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 mb-3 border-b-[2px] border-[#121c1b]">
      <Tag className={`flex items-center gap-2 font-bold tracking-tight ${Tag === 'h1' ? 'text-lg sm:text-2xl' : 'text-base sm:text-lg'}`}>
        <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 bg-[#8b2635] shrink-0" aria-hidden />
        {children}
      </Tag>
      {action && <div className="flex items-center gap-2 flex-wrap">{action}</div>}
    </div>
  );
}

export function Card({
  children,
  className = '',
  tone = 'white',
  title,
  action,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'white' | 'slate' | 'parchment' | 'teal' | 'carmine';
  title?: React.ReactNode;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const bg = {
    white: 'bg-white text-[#121c1b]',
    slate: 'bg-[#ebf6f4] text-[#121c1b]',
    parchment: 'bg-[#ede8dc] text-[#121c1b]',
    teal: 'bg-[#1d635d] text-white',
    carmine: 'bg-[#8b2635] text-[#f1fcf9]',
  }[tone];
  return (
    <section style={style} className={`${bg} border-[2.5px] border-[#121c1b] shadow-[4px_4px_0px_rgba(18,28,27,0.85)] p-3 sm:p-4 ${className}`}>
      {title && <SectionTitle action={action}>{title}</SectionTitle>}
      {children}
    </section>
  );
}

/** Poster roadmap-card header: a deep-teal bar with a numbered box and a mono caps label. */
export function StripHeader({ n, label, right }: { n?: React.ReactNode; label: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-white border-b-[2px] border-[#121c1b]" style={{ background: DEEP_TEAL }}>
      {n !== undefined && <span className="min-w-[22px] h-[22px] px-1 bg-white text-[#121c1b] border-[2px] border-[#121c1b] flex items-center justify-center font-label-mono-sm">{n}</span>}
      <span className="font-label-mono-md uppercase truncate">{label}</span>
      {right && <span className="ml-auto shrink-0">{right}</span>}
    </div>
  );
}

/** Page title as a poster section: white card, carmine marker, rule, actions on the right. */
export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="bg-white border-[2.5px] border-[#121c1b] shadow-[4px_4px_0px_rgba(18,28,27,0.85)] px-3 sm:px-4 pt-3 pb-2.5">
      <SectionTitle as="h1" action={children}>
        {title}
      </SectionTitle>
      {subtitle && <p className="font-label-mono-sm text-[#3f4947] -mt-1.5">{subtitle}</p>}
    </section>
  );
}

/** The PerfuSense mark from the poster: stacked layers (sensor grid, sheet, alarm) in a rounded tile. */
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect x="1.5" y="1.5" width="37" height="37" rx="8" fill="#f1fcf9" stroke="#121c1b" strokeWidth="3" />
      <path d="M20 25 L32 30 L20 35 L8 30 Z" fill="#8b2635" stroke="#121c1b" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M20 17 L32 22 L20 27 L8 22 Z" fill="#ffffff" stroke="#121c1b" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M20 6 L32 11 L20 16 L8 11 Z" fill="#1d635d" stroke="#121c1b" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 8.5 L26 13.5 M20 6 L20 16 M26 8.5 L14 13.5" stroke="#adefe7" strokeWidth="1" />
    </svg>
  );
}

/** A button-like header that expands its content below with a smooth height animation. */
export function Disclosure({
  open,
  onToggle,
  summary,
  children,
  className = '',
}: {
  open: boolean;
  onToggle: () => void;
  summary: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full text-left flex items-center gap-2">
        <span className="flex-1 min-w-0">{summary}</span>
        <span className="chevron font-label-mono-sm" aria-hidden>
          ▾
        </span>
      </button>
      <div className="collapse" data-open={open}>
        <div>{children}</div>
      </div>
    </div>
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
