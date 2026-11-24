export const iso = (d: Date = new Date()) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => {
  const d = new Date(s + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const dayOfWeek = (s: string) => new Date(s + 'T12:00:00').getDay();
export const fmt = (s: string) =>
  new Date(s + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
