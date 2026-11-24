import { addDays } from './dates';
export type Sex = 'hombre' | 'mujer';
export type Activity = 'sedentario' | 'ligero' | 'moderado' | 'intenso' | 'atleta';

export const ACTIVITY_FACTORS: Record<Activity, number> =
  { sedentario: 1.2, ligero: 1.375, moderado: 1.55, intenso: 1.725, atleta: 1.9 };
export const ACTIVITY_LABELS: Record<Activity, string> = {
  sedentario: 'Sedentario', ligero: 'Ligero (1-3 días/sem)', moderado: 'Moderado (3-5 días/sem)',
  intenso: 'Intenso (6-7 días/sem)', atleta: 'Atleta',
};
export const MIN_KCAL: Record<Sex, number> = { hombre: 1500, mujer: 1200 };
export const DEFICITS = [
  { value: 250, label: 'Suave', hint: '-250 kcal' },
  { value: 500, label: 'Moderado', hint: '-500 kcal' },
  { value: 750, label: 'Agresivo', hint: '-750 kcal' },
] as const;

/** Mifflin-St Jeor */
export const bmr = (sex: Sex, weightKg: number, heightCm: number, age: number) =>
  10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'hombre' ? 5 : -161);

export interface TargetInput {
  sex: Sex; weightKg: number; heightCm: number; age: number; activity: Activity; deficit: number;
}
export interface Targets {
  bmr: number; tdee: number; kcal: number; protein_g: number; carbs_g: number; fat_g: number;
  clamped: boolean; minKcal: number;
}

export function computeTargets(i: TargetInput): Targets {
  const b = bmr(i.sex, i.weightKg, i.heightCm, i.age);
  const tdee = b * ACTIVITY_FACTORS[i.activity];
  const minKcal = MIN_KCAL[i.sex];
  const raw = tdee - i.deficit;
  const clamped = raw < minKcal;
  const kcal = Math.round(clamped ? minKcal : raw);
  // Proteína alta (2 g/kg) con tope del 40 % de las calorías; grasa 25 %; resto carbohidratos
  const protein = Math.min(2 * i.weightKg, (0.4 * kcal) / 4);
  const fat = (0.25 * kcal) / 9;
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  return {
    bmr: Math.round(b), tdee: Math.round(tdee), kcal, clamped, minKcal,
    protein_g: Math.round(protein), carbs_g: Math.round(carbs), fat_g: Math.round(fat),
  };
}

/** MET aproximados (Compendio de Actividades Físicas). Para fuerza, los minutos son el tiempo total de la sesión. */
export const EXERCISE_GROUPS: Record<string, Record<string, number>> = {
  Cardio: {
    Caminar: 3.5, 'Caminata rápida': 4.3, 'Trote suave': 7, Correr: 9.8, Elíptica: 5, 'Bicicleta estática': 7,
    Ciclismo: 7.5, Spinning: 8.5, 'Remo (máquina)': 7, Escaladora: 9, 'Saltar cuerda': 11, Natación: 6,
    Senderismo: 6, Aeróbicos: 7.3, HIIT: 8,
  },
  'Pesas y barra': {
    'Press de banca (barra)': 5, 'Sentadilla con barra': 6, 'Peso muerto': 6, 'Press militar (barra)': 5,
    'Remo con barra': 5, 'Curl con barra': 4, 'Hip thrust': 5, Zancadas: 5,
  },
  Mancuernas: {
    'Circuito con mancuernas': 4.5, 'Press con mancuernas': 4.5, 'Remo con mancuerna': 4.5,
    'Curl de bíceps': 3.5, 'Elevaciones laterales': 3.5, Kettlebell: 6,
  },
  'Poleas y máquinas': {
    'Jalón al pecho (polea)': 4, 'Remo en polea baja': 4, 'Tríceps en polea': 3.5, 'Face pull / polea alta': 3.5,
    'Crossover en poleas': 4, 'Prensa de piernas': 5, 'Extensión de cuádriceps': 3.5, 'Curl femoral': 3.5,
    'Press de pecho en máquina': 4, 'Aductores / abductores': 3.5,
  },
  'Peso corporal y core': {
    Flexiones: 5, Dominadas: 6, Fondos: 5, Plancha: 3.3, Abdominales: 3.8, Burpees: 8,
  },
  'Deportes y otros': {
    Fútbol: 7, Básquetbol: 6.5, Tenis: 7.3, Pádel: 6, 'Boxeo (saco)': 5.5, Baile: 5, Yoga: 2.5, Pilates: 3, Estiramientos: 2.3,
  },
};
export const EXERCISES: Record<string, number> = Object.assign({}, ...Object.values(EXERCISE_GROUPS));
export const exerciseKcal = (type: string, minutes: number, weightKg: number) =>
  Math.round(((EXERCISES[type] ?? 4) * weightKg * minutes) / 60);

export const itemKcal = (kcalPer100: number, grams: number) => Math.round(((kcalPer100 * grams) / 100) * 10) / 10;

/** Regresión lineal sobre los últimos 28 días. Devuelve fecha ISO o null si no hay tendencia hacia la meta. */
export function estimateGoalDate(
  weights: { date: string; weight_kg: number }[], goal: number, today: string,
): string | null {
  const from = addDays(today, -28);
  const pts = weights.filter((w) => w.date >= from && w.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 3) return null;
  const t0 = new Date(pts[0].date).getTime();
  const xs = pts.map((p) => (new Date(p.date).getTime() - t0) / 86400000);
  if (xs[xs.length - 1] < 7) return null;
  const ys = pts.map((p) => p.weight_kg);
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const slope = num / den; // kg/día
  const current = ys[n - 1];
  if (Math.abs(current - goal) < 0.1) return today;
  const days = (goal - current) / slope;
  if (!isFinite(days) || days <= 0 || days > 730) return null;
  return addDays(today, Math.ceil(days));
}
