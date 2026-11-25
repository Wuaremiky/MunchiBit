import { describe, expect, it } from 'vitest';
import { bmr, computeTargets, dayActivityKcal, estimateGoalDate, exerciseKcal } from '../src/lib/calc';
import { plateau, safetyAlerts, streak, weeklyAverages, type DaySummary } from '../src/lib/recommendations';
import { addDays } from '../src/lib/dates';

describe('calc', () => {
  it('Mifflin-St Jeor por sexo', () => {
    expect(bmr('hombre', 80, 180, 30)).toBe(1780);
    expect(bmr('mujer', 60, 165, 30)).toBeCloseTo(1320.25);
  });
  it('aplica déficit y macros', () => {
    const t = computeTargets({ sex: 'hombre', weightKg: 80, heightCm: 180, age: 30, activity: 'moderado', deficit: 500 });
    expect(t.tdee).toBe(2759);
    expect(t.kcal).toBe(2259);
    expect(t.protein_g).toBe(160);
    expect(t.clamped).toBe(false);
  });
  it('respeta el mínimo seguro', () => {
    const t = computeTargets({ sex: 'mujer', weightKg: 60, heightCm: 165, age: 30, activity: 'sedentario', deficit: 750 });
    expect(t.kcal).toBe(1200);
    expect(t.clamped).toBe(true);
  });
  it('calcula calorías de ejercicio', () => expect(exerciseKcal('Correr', 30, 70)).toBe(343));
  it('elíptica 40 min a 70 kg', () => expect(exerciseKcal('Elíptica', 40, 70)).toBe(233));
  it('ejercicio con barra', () => expect(exerciseKcal('Sentadilla con barra', 45, 80)).toBe(360));
  it('actividad del día escala por peso', () => {
    expect(dayActivityKcal('normal', 70)).toBe(0);
    expect(dayActivityKcal('activo', 70)).toBe(150);
    expect(dayActivityKcal('muy_activo', 70)).toBe(300);
    expect(dayActivityKcal('activo', 90)).toBe(190);
  });
  it('estima fecha meta', () => {
    const today = '2026-11-23';
    const w = [0, 7, 14, 21].map((i) => ({ date: addDays(today, -21 + i), weight_kg: 80 - i * 0.1 }));
    const d = estimateGoalDate(w, 75, today);
    expect(d).not.toBeNull();
    expect(d! > today).toBe(true);
  });
});

const day = (date: string, kcal: number, logged = true): DaySummary =>
  ({ date, kcal, protein: 0, logged, glasses: 0, burned: 0 });

describe('recomendaciones', () => {
  it('racha ignora hoy sin registro', () => {
    const s = [day('2026-11-21', 1800), day('2026-11-22', 1900), day('2026-11-23', 0, false)];
    expect(streak(s, () => 2000)).toBe(2);
  });
  it('detecta meseta', () => {
    const today = '2026-11-23';
    const weights = [-14, -13, -7, -6, 0, -1].map((o) => ({ date: addDays(today, o), weight_kg: 80 }));
    const sums = Array.from({ length: 14 }, (_, i) => day(addDays(today, -i), 1800));
    expect(weeklyAverages(weights, today, 3).every((x) => x === 80)).toBe(true);
    expect(plateau(weights, sums, today)?.id).toBe('plateau');
  });
  it('alerta por ingesta baja repetida', () => {
    const s = [day('a', 900), day('b', 1000), day('c', 1100)];
    expect(safetyAlerts(s, 1200, false)[0].id).toBe('low');
  });
});
