/** "45m" or "1h 12m" from a number of minutes. */
export function fmtRemaining(totalMin: number): string {
  const m = Math.max(0, Math.round(totalMin));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

/** "+05:14" from a number of seconds overdue. */
export function fmtOverdue(sec: number): string {
  const mm = Math.floor(sec / 60);
  const ss = Math.floor(sec % 60);
  return `+${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function clock(d: Date, tz: string, seconds: boolean): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: seconds ? '2-digit' : undefined,
    hour12: false,
  }).format(d);
}

function dayKey(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d); // YYYY-MM-DD
}

function tzShort(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(d);
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? tz;
}

/** The timestamp text the UI shows in the audit log: "07:44:12 EST", "Yesterday 23:40", or a date. */
export function auditTimestamp(at: Date, now: Date, tz: string): string {
  const today = dayKey(now, tz);
  const that = dayKey(at, tz);
  if (that === today) return `${clock(at, tz, true)} ${tzShort(at, tz)}`;
  const yesterday = dayKey(new Date(now.getTime() - 24 * 3600 * 1000), tz);
  if (that === yesterday) return `Yesterday ${clock(at, tz, false)}`;
  return `${that} ${clock(at, tz, false)}`;
}

/** "07:44" in ward time. */
export function shortClock(at: Date, tz: string): string {
  return clock(at, tz, false);
}
