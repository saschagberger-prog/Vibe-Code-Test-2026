const deDays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const deMonths = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
];

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDue(dateStr: string | null): { label: string; tone: 'overdue' | 'today' | 'normal' } | null {
  if (!dateStr) return null;
  const today = todayStr();
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  if (dateStr === today) return { label: 'Heute', tone: 'today' };
  const diff = Math.round((d.getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000);
  if (diff === 1) return { label: 'Morgen', tone: 'normal' };
  if (diff === -1) return { label: 'Gestern', tone: 'overdue' };
  if (diff < 0) return { label: 'Überfällig', tone: 'overdue' };
  const label = `${deDays[d.getDay()]}, ${d.getDate()}. ${deMonths[d.getMonth()]}`;
  return { label, tone: 'normal' };
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${date}, ${time} Uhr`;
}

export function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

export function toDateTimeLocalValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
