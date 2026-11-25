import { useState } from 'react';
import { Droplets, Flame, Minus, Plus } from 'lucide-react';
import Mascot, { type Mood } from '../components/Mascot';
import { supabase } from '../lib/supabase';
import { iso } from '../lib/dates';
import { goalFor, plateau, realtimeSuggestions, safetyAlerts, streak, summarize } from '../lib/recommendations';
import { computeTargets, DAY_ACTIVITY, dayActivityKcal, type DayActivity } from '../lib/calc';
import type { Props } from '../types';
import CardList from '../components/CardList';

const Bar = ({ label, v, max, color }: { label: string; v: number; max: number; color: string }) => (
  <div><div className="flex justify-between text-sm font-semibold"><span>{label}</span><span>{Math.round(v)} / {max} g</span></div>
    <div className="mt-1 h-2.5 rounded-full bg-ink/10" role="progressbar" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemax={max}>
      <div className="h-2.5 rounded-full transition-all" style={{ width: `${Math.min(100, (v / Math.max(max, 1)) * 100)}%`, background: color }} /></div></div>
);

export default function Today({ userId, data, reload, goTo }: Props & { goTo: (t: 'registrar') => void }) {
  const p = data.profile, today = iso(), hour = new Date().getHours();
  const [busy, setBusy] = useState(false);
  const sums = summarize(data, 14, today);
  const td = sums[sums.length - 1];
  const goalKcal = p.daily_kcal ?? 2000;
  const level = (data.activity.find((a) => a.date === today)?.level ?? 'normal') as DayActivity;
  const extra = dayActivityKcal(level, p.weight_kg ?? 70);
  const budget = goalKcal + (p.add_exercise_calories ? td.burned + extra : 0);
  const left = Math.round(budget - td.kcal);
  const scale = budget / Math.max(goalKcal, 1); // el ejercicio sumado también amplía los macros
  const meals = data.meals.filter((m) => m.date === today);
  const sum = (k: 'protein_g' | 'carbs_g' | 'fat_g') => meals.reduce((s, m) => s + m[k], 0);
  const days = streak(sums, (d) => goalFor(data.goals, d, goalKcal));
  const minKcal = p.sex ? computeTargets({ sex: p.sex, weightKg: p.weight_kg ?? 70, heightCm: p.height_cm ?? 170, age: p.age ?? 30, activity: p.activity_level ?? 'sedentario', deficit: p.deficit_kcal }).minKcal : 1200;

  let mood: Mood = 'feliz', msg = '¡Vas muy bien! Sigue así.';
  if (!td.logged) { mood = 'neutral'; msg = `¡Hola${p.name ? ', ' + p.name : ''}! Registra tu primera comida del día.`; }
  else if (td.kcal > budget * 1.15) { mood = 'preocupado'; msg = 'Hoy comiste de más y no pasa nada. Mañana seguimos juntos.'; }
  else if (hour >= 20 && td.kcal < minKcal) { mood = 'preocupado'; msg = 'Comiste muy poco hoy. Tu cuerpo necesita energía: come algo nutritivo.'; }
  else if (days >= 3 && left >= 0) { mood = 'celebrando'; msg = `¡${days} días seguidos dentro de tu meta! Increíble.`; }
  else if (left >= 0 && left <= goalKcal * 0.15) { mood = 'motivado'; msg = `¡Casi llegas! Te quedan ${left} kcal.`; }

  const cards = [
    ...safetyAlerts(sums.slice(-7), minKcal, false),
    ...realtimeSuggestions({ goalKcal: budget, goalProtein: Math.round((p.protein_g ?? 100) * scale), kcal: td.kcal, protein: td.protein, hour, foods: data.foods }),
    ...(plateau(data.weights, sums, today) ? [plateau(data.weights, sums, today)!] : []),
  ].slice(0, 3);

  const [actErr, setActErr] = useState<string | null>(null);
  async function setLevel(l: DayActivity) {
    setBusy(true); setActErr(null);
    const { error } = await supabase.from('activity_logs').upsert({ user_id: userId, date: today, level: l }, { onConflict: 'user_id,date' });
    if (error) setActErr('No pudimos guardar. ¿Ejecutaste supabase/daily_activity.sql?');
    await reload(); setBusy(false);
  }
  async function water(delta: number) {
    setBusy(true);
    await supabase.from('water_logs').upsert({ user_id: userId, date: today, glasses: Math.max(0, td.glasses + delta) }, { onConflict: 'user_id,date' });
    await reload(); setBusy(false);
  }
  const R = 54, C = 2 * Math.PI * R, pct = Math.min(1, td.kcal / Math.max(budget, 1));
  return (
    <div className="space-y-4">
      <section className="card flex items-center gap-3">
        <Mascot mood={mood} /><p className="text-lg font-bold" aria-live="polite">{msg}</p>
      </section>
      <section className="card flex items-center gap-4">
        <svg viewBox="0 0 130 130" className="h-36 w-36 shrink-0" role="img" aria-label={`${left} calorías restantes`}>
          <circle cx="65" cy="65" r={R} fill="none" stroke="#1F2A2E1A" strokeWidth="12" />
          <circle cx="65" cy="65" r={R} fill="none" stroke={left < 0 ? '#D6455D' : '#12806F'} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 65 65)" style={{ transition: 'stroke-dashoffset .6s' }} />
          <text x="65" y="64" textAnchor="middle" className="fill-ink text-2xl font-extrabold">{Math.abs(left)}</text>
          <text x="65" y="82" textAnchor="middle" className="fill-ink/70 text-[10px] font-semibold">{left < 0 ? 'kcal de más' : 'kcal restantes'}</text>
        </svg>
        <dl className="grid flex-1 grid-cols-1 gap-1 text-sm font-semibold">
          <div className="flex justify-between"><dt>Meta del día</dt><dd>{Math.round(budget)}</dd></div>
          <div className="flex justify-between"><dt>Consumidas</dt><dd>{Math.round(td.kcal)}</dd></div>
          <div className="flex justify-between"><dt>Ejercicio</dt><dd>+{Math.round(td.burned)}{p.add_exercise_calories ? '' : ' (no suma)'}</dd></div>
          {extra > 0 && <div className="flex justify-between"><dt>Actividad del día</dt><dd>+{extra}{p.add_exercise_calories ? '' : ' (no suma)'}</dd></div>}
        </dl>
      </section>
      <section className="card space-y-3">
        <Bar label="Proteínas" v={sum('protein_g')} max={Math.round((p.protein_g ?? 0) * scale)} color="#D6455D" />
        <Bar label="Carbohidratos" v={sum('carbs_g')} max={Math.round((p.carbs_g ?? 0) * scale)} color="#FFB020" />
        <Bar label="Grasas" v={sum('fat_g')} max={Math.round((p.fat_g ?? 0) * scale)} color="#3B82C4" />
      </section>
      <section className="card space-y-2">
        <h2 className="font-extrabold">Actividad de hoy</h2>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Actividad de hoy">
          {(Object.keys(DAY_ACTIVITY) as DayActivity[]).map((l) => (
            <button key={l} role="radio" aria-checked={level === l} disabled={busy} onClick={() => setLevel(l)}
              className={`rounded-2xl px-2 py-2 text-sm font-bold ${level === l ? 'bg-leaf text-white' : 'bg-ink/5'}`}>
              {DAY_ACTIVITY[l].label}<span className="block text-xs font-normal">{dayActivityKcal(l, p.weight_kg ?? 70) > 0 ? `+${dayActivityKcal(l, p.weight_kg ?? 70)} kcal` : 'base'}</span></button>))}
        </div>
        <p className="text-sm text-ink/70">{DAY_ACTIVITY[level].hint}. No cuentes aquí el ejercicio que ya registraste.
          {p.add_exercise_calories ? '' : ' Se suma a tu presupuesto si activas la opción de sumar calorías quemadas en Perfil.'}</p>
        {actErr && <p role="alert" className="text-sm font-semibold text-berry">{actErr}</p>}
      </section>
      <section className="grid grid-cols-2 gap-3">
        <div className="card"><p className="flex items-center gap-1 font-bold"><Flame size={18} className="text-mango" aria-hidden />Racha</p>
          <p className="text-3xl font-extrabold">{days} {days === 1 ? 'día' : 'días'}</p></div>
        <div className="card"><p className="flex items-center gap-1 font-bold"><Droplets size={18} className="text-sky" aria-hidden />Agua</p>
          <div className="flex items-center justify-between">
            <button className="btn-ghost !p-2" disabled={busy} onClick={() => water(-1)} aria-label="Quitar un vaso"><Minus size={16} /></button>
            <p className="text-2xl font-extrabold">{td.glasses}<span className="text-base text-ink/60">/{p.water_goal}</span></p>
            <button className="btn !p-2" disabled={busy} onClick={() => water(1)} aria-label="Agregar un vaso"><Plus size={16} /></button></div></div>
      </section>
      <CardList cards={cards} userId={userId} reload={reload} profile={p} />
      {!td.logged && <button className="btn w-full" onClick={() => goTo('registrar')}>Registrar mi primera comida</button>}
    </div>
  );
}
