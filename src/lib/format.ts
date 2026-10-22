export const fmtPts = (n: number | null | undefined, digits = 1) => {
  const v = Number(n ?? 0)
  return (Math.abs(v) < 0.05 ? 0 : v).toFixed(digits).replace('-', '−')
}

export function fmtDuration(ms: number): string {
  if (ms <= 0) return '0s'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`
  return `${sec}s`
}

/** "12h 30m" for a pick-clock length given in minutes. */
export function fmtMinutes(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h} hour${h === 1 ? '' : 's'}`
}

export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'TBD'

export const fmtTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : 'TBD'

export const fmtDay = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Date TBD'

export const dayKey = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-CA') : 'tbd')

/** Riot serves some images over http; upgrade so they load on an https site. */
export const img = (url: string | null | undefined) => (url ? url.replace(/^http:\/\//, 'https://') : undefined)

export const STAGE_LABEL: Record<string, string> = {
  play_ins: 'Play-Ins',
  swiss: 'Swiss Stage',
  knockouts: 'Knockouts',
}
export const stageLabel = (s: string) => STAGE_LABEL[s] ?? s.replace(/_/g, ' ')

export const rate = (n: number, games: number) => (games > 0 ? n / games : 0)
