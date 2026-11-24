import { ACTIVITY_LABELS, DEFICITS, type Activity } from '../lib/calc';
import { previewTargets, type FormState } from '../lib/data';

const AVATARS = ['🦝', '🦊', '🐻', '🐼', '🐸', '🐯', '🐰', '🦁'];
type P = { f: FormState; set: (f: FormState) => void };
const num = (f: FormState, set: P['set'], k: keyof FormState, label: string, unit: string, step = '1') => (
  <div><label className="label" htmlFor={k}>{label} ({unit})</label>
    <input id={k} inputMode="decimal" type="number" step={step} className="input" value={f[k] as string}
      onChange={(e) => set({ ...f, [k]: e.target.value })} /></div>
);

export function Identity({ f, set }: P) {
  return (<div className="space-y-3">
    <div><label className="label" htmlFor="name">Nombre</label>
      <input id="name" className="input" value={f.name} onChange={(e) => set({ ...f, name: e.target.value })} /></div>
    <div><span className="label">Avatar</span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Avatar">
        {AVATARS.map((a) => (<button key={a} type="button" role="radio" aria-checked={f.avatar === a} onClick={() => set({ ...f, avatar: a })}
          className={`h-12 w-12 rounded-2xl text-2xl ${f.avatar === a ? 'bg-leaf/20 ring-2 ring-leaf' : 'bg-ink/5'}`}>{a}</button>))}
      </div></div></div>);
}

export function Body({ f, set }: P) {
  return (<div className="space-y-3">
    <div><span className="label">Sexo biológico</span>
      <div className="grid grid-cols-2 gap-2">{(['hombre', 'mujer'] as const).map((s) => (
        <button key={s} type="button" aria-pressed={f.sex === s} onClick={() => set({ ...f, sex: s })}
          className={`rounded-2xl py-2.5 font-bold capitalize ${f.sex === s ? 'bg-leaf text-white' : 'bg-ink/5'}`}>{s}</button>))}</div></div>
    <div className="grid grid-cols-3 gap-2">{num(f, set, 'age', 'Edad', 'años')}{num(f, set, 'height', 'Altura', 'cm')}{num(f, set, 'weight', 'Peso', 'kg', '0.1')}</div></div>);
}

export function Activity_({ f, set }: P) {
  return (<div className="space-y-2" role="radiogroup" aria-label="Nivel de actividad">
    {(Object.keys(ACTIVITY_LABELS) as Activity[]).map((a) => (
      <button key={a} type="button" role="radio" aria-checked={f.activity === a} onClick={() => set({ ...f, activity: a })}
        className={`w-full rounded-2xl px-4 py-3 text-left font-bold ${f.activity === a ? 'bg-leaf text-white' : 'bg-ink/5'}`}>{ACTIVITY_LABELS[a]}</button>))}</div>);
}

export function Goal({ f, set }: P) {
  const t = previewTargets(f);
  return (<div className="space-y-3">
    {num(f, set, 'goalWeight', 'Peso meta', 'kg', '0.1')}
    <div><span className="label">Velocidad</span>
      <div className="grid grid-cols-3 gap-2">{DEFICITS.map((d) => (
        <button key={d.value} type="button" aria-pressed={f.deficit === d.value} onClick={() => set({ ...f, deficit: d.value })}
          className={`rounded-2xl py-2 text-sm font-bold ${f.deficit === d.value ? 'bg-leaf text-white' : 'bg-ink/5'}`}>{d.label}<br /><span className="font-normal">{d.hint}</span></button>))}</div></div>
    <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={f.addExercise} onChange={(e) => set({ ...f, addExercise: e.target.checked })} className="h-5 w-5 accent-leaf" />
      Sumar calorías del ejercicio a mi presupuesto diario</label>
    {num(f, set, 'waterGoal', 'Meta de agua', 'vasos')}
    {t && (<div className="rounded-2xl bg-leaf/10 p-3 text-sm" aria-live="polite">
      <p className="font-bold">Tu meta: {t.kcal} kcal/día</p>
      <p>Proteína {t.protein_g} g · Carbohidratos {t.carbs_g} g · Grasas {t.fat_g} g</p>
      <p className="text-ink/70">TMB {t.bmr} · Gasto total {t.tdee} kcal</p>
      {t.clamped && <p className="mt-1 font-semibold text-berry">Ajustamos tu meta al mínimo seguro de {t.minKcal} kcal. Elige un ritmo más suave para sostenerlo.</p>}
    </div>)}</div>);
}
