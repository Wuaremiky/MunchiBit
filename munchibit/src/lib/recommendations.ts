import { addDays, dayOfWeek, iso } from './dates';
import type { AppData, Food, Goal } from '../types';

export interface Card {
  id: string; tone: 'info' | 'warn' | 'success'; title: string; body: string; action?: 'recalc';
}
export interface DaySummary { date: string; kcal: number; protein: number; logged: boolean; glasses: number; burned: number }

export function goalFor(goals: Goal[], date: string, fallback: number): number {
  const sorted = [...goals].sort((a, b) => a.effective_from.localeCompare(b.effective_from));
  const past = sorted.filter((g) => g.effective_from <= date);
  return (past.length ? past[past.length - 1] : sorted[0])?.kcal ?? fallback;
}

export function summarize(d: Pick<AppData, 'meals' | 'exercise' | 'water'>, days: number, today = iso()): DaySummary[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, -(days - 1 - i));
    const m = d.meals.filter((x) => x.date === date);
    return {
      date,
      kcal: m.reduce((s, x) => s + x.kcal, 0),
      protein: m.reduce((s, x) => s + x.protein_g, 0),
      logged: m.length > 0,
      glasses: d.water.find((w) => w.date === date)?.glasses ?? 0,
      burned: d.exercise.filter((x) => x.date === date).reduce((s, x) => s + x.kcal_burned, 0),
    };
  });
}

/** Racha: días consecutivos con registro y dentro del objetivo (+5 %). El día de hoy sin registro no corta la racha. */
export function streak(sums: DaySummary[], goalOf: (date: string) => number): number {
  let i = sums.length - 1;
  if (i >= 0 && !sums[i].logged) i--;
  let n = 0;
  for (; i >= 0; i--) {
    if (sums[i].logged && sums[i].kcal <= goalOf(sums[i].date) * 1.05) n++;
    else break;
  }
  return n;
}

/** Promedio de peso por semana (4 bloques de 7 días, del más antiguo al más reciente). */
export function weeklyAverages(weights: { date: string; weight_kg: number }[], today: string, weeks = 4): (number | null)[] {
  return Array.from({ length: weeks }, (_, w) => {
    const end = addDays(today, -7 * (weeks - 1 - w));
    const start = addDays(end, -6);
    const ws = weights.filter((x) => x.date >= start && x.date <= end);
    return ws.length ? ws.reduce((s, x) => s + x.weight_kg, 0) / ws.length : null;
  });
}

export function realtimeSuggestions(p: {
  goalKcal: number; goalProtein: number; kcal: number; protein: number; hour: number; foods: Food[];
}): Card[] {
  const cards: Card[] = [];
  const kcalLeft = p.goalKcal - p.kcal;
  const proteinLeft = p.goalProtein - p.protein;
  if (p.hour >= 17 && p.kcal > 0 && proteinLeft / p.goalProtein > 0.4 && kcalLeft > 0 && kcalLeft < 600) {
    const picks = p.foods
      .filter((f) => f.kcal_100g > 0 && (f.protein_100g * 4) / f.kcal_100g >= 0.5)
      .map((f) => ({ f, kcal: (f.kcal_100g * f.serving_g) / 100, prot: (f.protein_100g * f.serving_g) / 100 }))
      .filter((x) => x.kcal <= kcalLeft)
      .sort((a, b) => b.prot / b.kcal - a.prot / a.kcal)
      .slice(0, 3);
    if (picks.length) cards.push({
      id: 'protein-dinner', tone: 'info', title: 'Te falta proteína para cerrar el día',
      body: `Te quedan ~${Math.round(proteinLeft)} g de proteína y ${Math.round(kcalLeft)} kcal. Buenas opciones: ` +
        picks.map((x) => `${x.f.name} (${x.f.serving_label}: ${Math.round(x.prot)} g, ${Math.round(x.kcal)} kcal)`).join('; ') + '.',
    });
  }
  if (kcalLeft < -p.goalKcal * 0.1) cards.push({
    id: 'over', tone: 'info', title: 'Un día más alto no define tu progreso',
    body: 'Lo que cuenta es la tendencia semanal. No compenses saltándote comidas: retoma tu plan en la próxima comida.',
  });
  return cards;
}

export function plateau(weights: { date: string; weight_kg: number }[], sums14: DaySummary[], today = iso()): Card | null {
  const a = weeklyAverages(weights, today, 3);
  if (a.some((x) => x === null)) return null;
  const [w1, w2, w3] = a as number[];
  const adherence = sums14.filter((s) => s.logged).length;
  if (adherence >= 10 && w2 - w1 > -0.1 && w3 - w2 > -0.1) return {
    id: 'plateau', tone: 'info', action: 'recalc', title: 'Tu peso lleva 2 semanas estable',
    body: 'Es normal y no es un fracaso. Revisa porciones ocultas (aceites, salsas, bebidas), suma pasos diarios (NEAT) o recalcula tus metas con tu peso actual.',
  };
  return null;
}

export function weeklyPatterns(sums: DaySummary[], goalKcal: number, waterGoal: number): Card[] {
  const cards: Card[] = [];
  const logged = sums.filter((s) => s.logged);
  const wk = logged.filter((s) => [0, 6].includes(dayOfWeek(s.date)));
  const wd = logged.filter((s) => ![0, 6].includes(dayOfWeek(s.date)));
  const avg = (x: DaySummary[]) => x.reduce((s, d) => s + d.kcal, 0) / x.length;
  if (wk.length >= 2 && wd.length >= 3 && avg(wk) > avg(wd) * 1.15) cards.push({
    id: 'weekend', tone: 'info', title: 'Tus fines de semana suben',
    body: `Comes ~${Math.round(avg(wk) - avg(wd))} kcal más por día. Planifica una comida libre en vez de varias, y deja el snack del sábado ya medido.`,
  });
  const train = sums.filter((s) => s.burned > 0);
  if (train.length >= 2 && train.reduce((s, d) => s + d.glasses, 0) / train.length < waterGoal * 0.7) cards.push({
    id: 'water', tone: 'info', title: 'Poca agua en días de entreno',
    body: 'Cuando entrenas bebes menos de lo que necesitas. Deja una botella lista antes de empezar y toma un vaso al terminar.',
  });
  const binge = sums.some((s, i) => i < sums.length - 1 && s.logged && s.kcal < goalKcal * 0.75 && sums[i + 1].kcal > goalKcal * 1.15);
  if (binge) cards.push({
    id: 'binge', tone: 'warn', title: 'Un día muy bajo empuja a un día alto',
    body: 'Tras comer muy poco, el día siguiente se dispara. Un déficit más suave y comidas con proteína repartidas durante el día te dan más constancia.',
  });
  if (!cards.length) cards.push({
    id: 'balanced', tone: 'success', title: 'Semana equilibrada',
    body: 'No vemos patrones de riesgo. Sigue registrando para detectar tendencias.',
  });
  return cards.slice(0, 3);
}

export function safetyAlerts(sums7: DaySummary[], minKcal: number, clamped: boolean): Card[] {
  const cards: Card[] = [];
  const low = sums7.filter((s) => s.logged && s.kcal < minKcal).length;
  if (low >= 3) cards.push({
    id: 'low', tone: 'warn', title: 'Estás comiendo por debajo del mínimo saludable',
    body: `Llevas ${low} días con menos de ${minKcal} kcal. Comer muy poco ralentiza el metabolismo y dificulta mantener el plan. Es mejor bajar más despacio y sostenerlo.`,
  });
  if (clamped) cards.push({
    id: 'clamped', tone: 'info', title: 'Ajustamos tu meta al mínimo seguro',
    body: `El déficit elegido llevaba tu meta por debajo de ${minKcal} kcal, así que usamos ese mínimo. Un ritmo suave es más sostenible.`,
  });
  return cards;
}
