import { useMemo, useState } from 'react';
import { Heart, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { iso } from '../lib/dates';
import { EXERCISE_GROUPS, exerciseKcal, itemKcal } from '../lib/calc';
import type { Food, MealType, Props } from '../types';
import AiMeal from '../components/AiMeal';

const MEALS: { id: MealType; label: string }[] = [
  { id: 'desayuno', label: 'Desayuno' }, { id: 'almuerzo', label: 'Almuerzo' }, { id: 'cena', label: 'Cena' }, { id: 'snack', label: 'Snacks' },
];
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const EMPTY = { name: '', kcal: '', p: '', c: '', f: '', serving: '100', label: '1 porción' };

export default function Log({ userId, data, reload }: Props) {
  const today = iso();
  const [meal, setMeal] = useState<MealType>('desayuno');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Food | null>(null);
  const [grams, setGrams] = useState('100');
  const [showNew, setShowNew] = useState(false);
  const [nf, setNf] = useState(EMPTY);
  const [exSel, setExSel] = useState<Record<string, string>>({});
  const [exQ, setExQ] = useState('');
  const [exW, setExW] = useState(String(data.profile.weight_kg ?? 70));
  const fav = new Set(data.favorites);

  const list = useMemo(() => {
    if (q.trim()) return data.foods.filter((f) => norm(f.name).includes(norm(q))).slice(0, 20);
    const recentIds = [...data.meals].sort((a, b) => b.date.localeCompare(a.date)).map((m) => m.food_id).filter(Boolean) as string[];
    const ids = [...new Set([...data.favorites, ...recentIds])].slice(0, 12);
    const found = ids.map((id) => data.foods.find((f) => f.id === id)).filter(Boolean) as Food[];
    return found.length ? found : data.foods.slice(0, 10);
  }, [q, data]);

  const pick = (f: Food) => { setSel(f); setGrams(String(f.serving_g)); };
  const g = Math.max(0, +grams || 0);
  async function add() {
    if (!sel || !g) return;
    await supabase.from('meal_logs').insert({
      user_id: userId, date: today, meal_type: meal, food_id: sel.id, food_name: sel.name, quantity_g: g,
      kcal: itemKcal(sel.kcal_100g, g), protein_g: itemKcal(sel.protein_100g, g), carbs_g: itemKcal(sel.carbs_100g, g), fat_g: itemKcal(sel.fat_100g, g),
    });
    setSel(null); setQ(''); await reload();
  }
  async function toggleFav(f: Food) {
    if (fav.has(f.id)) await supabase.from('favorites').delete().eq('user_id', userId).eq('food_id', f.id);
    else await supabase.from('favorites').insert({ user_id: userId, food_id: f.id });
    await reload();
  }
  async function createFood(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from('foods').insert({
      created_by: userId, is_custom: true, name: nf.name, category: 'Mis alimentos', kcal_100g: +nf.kcal, protein_100g: +nf.p || 0,
      carbs_100g: +nf.c || 0, fat_100g: +nf.f || 0, serving_g: +nf.serving || 100, serving_label: nf.label || '1 porción',
    });
    setNf(EMPTY); setShowNew(false); await reload();
  }
  const del = async (table: string, id: string) => { await supabase.from(table).delete().eq('id', id); await reload(); };
  const toggleEx = (t: string) => {
    const n = { ...exSel };
    if (t in n) delete n[t]; else n[t] = '30';
    setExSel(n);
  };
  const exTotal = Object.entries(exSel).reduce((s, [t, m]) => s + exerciseKcal(t, +m || 0, +exW || 70), 0);
  async function addExercise() {
    const rows = Object.entries(exSel).filter(([, m]) => +m > 0).map(([type, m]) => ({
      user_id: userId, date: today, type, minutes: +m, kcal_burned: exerciseKcal(type, +m, +exW || 70),
    }));
    if (!rows.length) return;
    await supabase.from('exercise_logs').insert(rows);
    if (+exW > 0 && +exW !== data.profile.weight_kg) {
      await supabase.from('weight_logs').upsert({ user_id: userId, date: today, weight_kg: +exW }, { onConflict: 'user_id,date' });
    }
    setExSel({}); await reload();
  }
  async function toggleBudget(v: boolean) {
    await supabase.from('profiles').update({ add_exercise_calories: v }).eq('id', userId);
    await reload();
  }
  const todays = data.meals.filter((m) => m.date === today);
  const field = (k: keyof typeof EMPTY, label: string, type = 'number') => (
    <div><label className="label" htmlFor={'nf' + k}>{label}</label>
      <input id={'nf' + k} className="input" type={type} step="0.1" required={k === 'name' || k === 'kcal'} value={nf[k]} onChange={(e) => setNf({ ...nf, [k]: e.target.value })} /></div>);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-ink/5 p-1" role="tablist" aria-label="Tipo de comida">
        {MEALS.map((m) => (<button key={m.id} role="tab" aria-selected={meal === m.id} onClick={() => setMeal(m.id)}
          className={`rounded-xl py-2 text-sm font-bold ${meal === m.id ? 'bg-white shadow-sm' : ''}`}>{m.label}</button>))}
      </div>
      <AiMeal userId={userId} foods={data.foods} meal={meal} mealLabel={MEALS.find((m) => m.id === meal)!.label} reload={reload} />
      <section className="card space-y-3">
        <label className="label" htmlFor="q">Buscar alimento</label>
        <input id="q" className="input" placeholder="Ej: pollo, arroz, manzana…" value={q} onChange={(e) => setQ(e.target.value)} />
        {!q && <p className="text-sm font-semibold text-ink/60">Favoritos y recientes</p>}
        {sel ? (
          <div className="space-y-2 rounded-2xl bg-leaf/10 p-3">
            <p className="font-bold">{sel.name}</p>
            <div className="flex items-center gap-2">
              <input aria-label="Gramos" type="number" className="input w-28" value={grams} onChange={(e) => setGrams(e.target.value)} /><span>g</span>
              <button className="btn-ghost" onClick={() => setGrams(String(g + sel.serving_g))}>+ {sel.serving_label}</button>
            </div>
            <p className="text-sm">{itemKcal(sel.kcal_100g, g)} kcal · P {itemKcal(sel.protein_100g, g)} · C {itemKcal(sel.carbs_100g, g)} · G {itemKcal(sel.fat_100g, g)}</p>
            <div className="flex gap-2"><button className="btn flex-1" onClick={add}>Agregar a {MEALS.find((m) => m.id === meal)!.label.toLowerCase()}</button>
              <button className="btn-ghost" onClick={() => setSel(null)}>Cancelar</button></div>
          </div>
        ) : (
          <ul className="divide-y divide-ink/10">
            {list.map((f) => (<li key={f.id} className="flex items-center gap-2 py-2">
              <button className="flex-1 text-left" onClick={() => pick(f)}><span className="font-bold">{f.name}</span>
                <span className="block text-sm text-ink/70">{f.serving_label} · {Math.round((f.kcal_100g * f.serving_g) / 100)} kcal</span></button>
              <button onClick={() => toggleFav(f)} aria-pressed={fav.has(f.id)} aria-label={`Favorito: ${f.name}`} className="p-2">
                <Heart size={20} className={fav.has(f.id) ? 'fill-berry text-berry' : 'text-ink/40'} /></button></li>))}
            {!list.length && <li className="py-3 text-ink/70">No encontramos “{q}”. Crea el alimento con el botón de abajo.</li>}
          </ul>)}
        <button className="btn-ghost w-full" onClick={() => setShowNew(!showNew)}>{showNew ? 'Cerrar' : 'Crear alimento propio'}</button>
        {showNew && (<form onSubmit={createFood} className="grid grid-cols-2 gap-2">
          <div className="col-span-2">{field('name', 'Nombre', 'text')}</div>
          {field('kcal', 'Kcal por 100 g')}{field('p', 'Proteína (g)')}{field('c', 'Carbohidratos (g)')}{field('f', 'Grasas (g)')}
          {field('serving', 'Porción (g)')}{field('label', 'Nombre de la porción', 'text')}
          <button className="btn col-span-2">Guardar alimento</button></form>)}
      </section>
      <section className="card space-y-2">
        <h2 className="font-extrabold">Comidas de hoy</h2>
        {MEALS.map((m) => { const items = todays.filter((x) => x.meal_type === m.id); return items.length ? (
          <div key={m.id}><p className="text-sm font-bold text-ink/60">{m.label} · {Math.round(items.reduce((s, x) => s + x.kcal, 0))} kcal</p>
            {items.map((x) => (<div key={x.id} className="flex items-center justify-between py-1">
              <span>{x.food_name} <span className="text-sm text-ink/60">{x.quantity_g} g · {Math.round(x.kcal)} kcal</span></span>
              <button aria-label={`Eliminar ${x.food_name}`} className="p-2 text-berry" onClick={() => del('meal_logs', x.id)}><Trash2 size={16} /></button></div>))}</div>) : null; })}
        {!todays.length && <p className="text-ink/70">Aún no registras nada hoy. Busca un alimento arriba para empezar.</p>}
      </section>
      <section className="card space-y-3">
        <h2 className="font-extrabold">Ejercicio</h2>
        <input aria-label="Buscar ejercicio" className="input" placeholder="Buscar: sentadilla, polea, elíptica…" value={exQ} onChange={(e) => setExQ(e.target.value)} />
        <div className="space-y-2" role="group" aria-label="Elige uno o varios ejercicios">
          {Object.entries(EXERCISE_GROUPS).map(([group, items]) => {
            const names = Object.keys(items).filter((n) => !exQ.trim() || norm(n).includes(norm(exQ)));
            if (!names.length) return null;
            return (
              <details key={group} open={!!exQ.trim() || names.some((n) => n in exSel)} className="rounded-2xl bg-ink/5 p-2">
                <summary className="cursor-pointer px-1 py-1 font-bold">{group}</summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {names.map((t) => (
                    <button key={t} type="button" aria-pressed={t in exSel} onClick={() => toggleEx(t)}
                      className={`rounded-full px-3 py-1.5 text-sm font-bold ${t in exSel ? 'bg-leaf text-white' : 'bg-white'}`}>{t}</button>))}
                </div>
              </details>);
          })}
        </div>
        {Object.keys(exSel).length > 0 && (<div className="space-y-2">
          {Object.entries(exSel).map(([t, m]) => (<div key={t} className="flex items-center gap-2">
            <span className="flex-1 font-semibold">{t}</span>
            <input aria-label={`Minutos de ${t}`} type="number" className="input w-24" value={m} onChange={(e) => setExSel({ ...exSel, [t]: e.target.value })} />
            <span className="w-12 text-sm">min</span>
            <span className="w-20 text-right text-sm font-bold">{exerciseKcal(t, +m || 0, +exW || 70)} kcal</span></div>))}
          <div className="flex items-center gap-2"><label className="label !mb-0 flex-1" htmlFor="exw">Tu peso hoy (kg)</label>
            <input id="exw" type="number" step="0.1" className="input w-24" value={exW} onChange={(e) => setExW(e.target.value)} /></div>
          <p className="text-sm font-bold" aria-live="polite">Total estimado: {exTotal} kcal quemadas</p>
          <button className="btn w-full" onClick={addExercise}>Agregar {Object.keys(exSel).length} {Object.keys(exSel).length === 1 ? 'ejercicio' : 'ejercicios'}</button>
        </div>)}
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-leaf"
          checked={data.profile.add_exercise_calories} onChange={(e) => toggleBudget(e.target.checked)} />
          Sumar lo quemado a mi presupuesto de calorías de hoy</label>
        {data.exercise.filter((x) => x.date === today).map((x) => (<div key={x.id} className="flex items-center justify-between">
          <span>{x.type} · {x.minutes} min · {Math.round(x.kcal_burned)} kcal</span>
          <button aria-label={`Eliminar ${x.type}`} className="p-2 text-berry" onClick={() => del('exercise_logs', x.id)}><Trash2 size={16} /></button></div>))}
      </section>
    </div>
  );
}
