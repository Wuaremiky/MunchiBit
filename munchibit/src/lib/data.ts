import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { addDays, iso } from './dates';
import { computeTargets, type Activity, type Sex } from './calc';
import type { AppData } from '../types';

export function useAppData(userId: string) {
  const [data, setData] = useState<AppData | null>(null);
  const reload = useCallback(async () => {
    const since = addDays(iso(), -60);
    const [p, m, e, w, wt, g, f, fav] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('meal_logs').select('*').gte('date', since),
      supabase.from('exercise_logs').select('*').gte('date', since),
      supabase.from('water_logs').select('date,glasses').gte('date', since),
      supabase.from('weight_logs').select('date,weight_kg').order('date'),
      supabase.from('daily_goals').select('*').order('effective_from'),
      supabase.from('foods').select('*').order('name'),
      supabase.from('favorites').select('food_id'),
    ]);
    setData({
      profile: p.data as AppData['profile'], meals: m.data ?? [], exercise: e.data ?? [], water: w.data ?? [],
      weights: wt.data ?? [], goals: g.data ?? [], foods: f.data ?? [],
      favorites: (fav.data ?? []).map((x: { food_id: string }) => x.food_id),
    });
  }, [userId]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, reload };
}

export interface FormState {
  name: string; avatar: string; sex: Sex | ''; age: string; height: string; weight: string;
  activity: Activity | ''; goalWeight: string; deficit: 250 | 500 | 750; addExercise: boolean; waterGoal: string;
}

export const formFromProfile = (p: AppData['profile']): FormState => ({
  name: p.name ?? '', avatar: p.avatar_url?.replace('emoji:', '') ?? '🦝', sex: p.sex ?? '',
  age: p.age?.toString() ?? '', height: p.height_cm?.toString() ?? '', weight: p.weight_kg?.toString() ?? '',
  activity: p.activity_level ?? '', goalWeight: p.goal_weight_kg?.toString() ?? '', deficit: p.deficit_kcal,
  addExercise: p.add_exercise_calories, waterGoal: p.water_goal.toString(),
});

export const previewTargets = (f: FormState) =>
  f.sex && f.activity && +f.age > 0 && +f.height > 0 && +f.weight > 0
    ? computeTargets({ sex: f.sex, weightKg: +f.weight, heightCm: +f.height, age: +f.age, activity: f.activity, deficit: f.deficit })
    : null;

/** Guarda el perfil, recalcula metas y deja intacto el historial (la meta vigente se guarda por fecha). */
export async function saveProfile(userId: string, f: FormState) {
  const t = previewTargets(f);
  if (!t) throw new Error('Completa todos los datos para calcular tus metas.');
  const { error } = await supabase.from('profiles').update({
    name: f.name, avatar_url: 'emoji:' + f.avatar, sex: f.sex, age: +f.age, height_cm: +f.height, weight_kg: +f.weight,
    activity_level: f.activity, goal_weight_kg: f.goalWeight ? +f.goalWeight : null, deficit_kcal: f.deficit,
    add_exercise_calories: f.addExercise, water_goal: +f.waterGoal || 8, bmr: t.bmr, tdee: t.tdee,
    daily_kcal: t.kcal, protein_g: t.protein_g, carbs_g: t.carbs_g, fat_g: t.fat_g, onboarded: true,
  }).eq('id', userId);
  if (error) throw error;
  const date = iso();
  await supabase.from('daily_goals').upsert(
    { user_id: userId, effective_from: date, kcal: t.kcal, protein_g: t.protein_g, carbs_g: t.carbs_g, fat_g: t.fat_g },
    { onConflict: 'user_id,effective_from' });
  await supabase.from('weight_logs').upsert({ user_id: userId, date, weight_kg: +f.weight }, { onConflict: 'user_id,date' });
  return t;
}
