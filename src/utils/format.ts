export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function mondayOf(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - offset);
  return copy;
}

export function formatDayMonth(dateKey: string): string {
  const date = parseDateKey(dateKey);
  const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `${date.getDate()} de ${month}`;
}

export function formatWeekday(dateKey: string): string {
  const labels = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  return labels[parseDateKey(dateKey).getDay()] ?? '';
}

export function formatDistanceKm(meters: number, digits = 2): string {
  return (meters / 1000).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatMeters(meters: number): string {
  if (meters >= 1000) {
    const digits = meters % 1000 === 0 ? 0 : 1;
    return `${formatDistanceKm(meters, digits)} km`;
  }
  return `${Math.round(meters)} m`;
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.round((safe % 3600) / 60);
  if (hours <= 0) return `${minutes} min`;
  return `${hours}h ${String(minutes).padStart(2, '0')}min`;
}

export function formatPace(secondsPerKm: number | null | undefined): string {
  if (secondsPerKm == null || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '—';
  const rounded = Math.round(secondsPerKm);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function createId(): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') return cryptoRef.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
