import { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { iso } from '../lib/dates';
import { itemKcal } from '../lib/calc';
import type { Food, MealType } from '../types';

interface Row { key: number; name: string; grams: string; foodId: string; kcal: number; p: number; c: number; f: number; conf: string }
interface Item { name: string; match: string | null; grams: number; confidence: string; kcal_100g: number; protein_100g: number; carbs_100g: number; fat_100g: number }
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

async function shrink(file: File, max = 1280): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((ok, err) => { img.onload = ok; img.onerror = err; img.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
    cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', 0.8).split(',')[1];
  } finally { URL.revokeObjectURL(url); }
}

export default function PhotoMeal({ userId, foods, meal, mealLabel, reload }:
  { userId: string; foods: Food[]; meal: MealType; mealLabel: string; reload: () => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [note, setNote] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);

  const nut = (r: Row) => {
    const f = foods.find((x) => x.id === r.foodId);
    return f ? { kcal: f.kcal_100g, p: f.protein_100g, c: f.carbs_100g, f: f.fat_100g } : { kcal: r.kcal, p: r.p, c: r.c, f: r.f };
  };
  const total = (rows ?? []).reduce((s, r) => s + itemKcal(nut(r).kcal, +r.grams || 0), 0);

  async function onFile(file?: File) {
    if (!file) return;
    setBusy(true); setErr(null); setRows(null);
    try {
      const image = await shrink(file);
      const { data, error } = await supabase.functions.invoke('analyze-meal', {
        body: { image, mediaType: 'image/jpeg', catalog: foods.map((f) => f.name) },
      });
      if (error) {
        let msg = 'No pudimos analizar la foto. Inténtalo de nuevo.';
        try { msg = (await (error as unknown as { context: Response }).context.json()).message ?? msg; } catch { /* sin detalle */ }
        throw new Error(msg);
      }
      const items = data.items as Item[];
      setRemaining(data.remaining ?? null);
      setNote(data.note ?? '');
      if (!items.length) { setErr(data.note || 'No encontramos comida en la foto.'); return; }
      setRows(items.map((it, i) => {
        const f = foods.find((x) => norm(x.name) === norm(it.match ?? it.name));
        return { key: i, name: f?.name ?? it.name, grams: String(it.grams), foodId: f?.id ?? '', kcal: it.kcal_100g, p: it.protein_100g, c: it.carbs_100g, f: it.fat_100g, conf: it.confidence };
      }));
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }

  const upd = (key: number, patch: Partial<Row>) => setRows((rs) => rs!.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const pickFood = (key: number, id: string) => {
    const f = foods.find((x) => x.id === id);
    upd(key, { foodId: id, ...(f ? { name: f.name } : {}) });
  };
  const addRow = (id: string) => {
    const f = foods.find((x) => x.id === id); if (!f) return;
    setRows((rs) => [...(rs ?? []), { key: Date.now(), name: f.name, grams: String(f.serving_g), foodId: f.id, kcal: 0, p: 0, c: 0, f: 0, conf: 'alta' }]);
  };

  async function confirm() {
    const list = (rows ?? []).filter((r) => +r.grams > 0 && r.name.trim()).map((r) => {
      const n = nut(r), g = +r.grams;
      return { user_id: userId, date: iso(), meal_type: meal, food_id: r.foodId || null, food_name: r.name.trim(), quantity_g: g,
        kcal: itemKcal(n.kcal, g), protein_g: itemKcal(n.p, g), carbs_g: itemKcal(n.c, g), fat_g: itemKcal(n.f, g) };
    });
    if (!list.length) return;
    setBusy(true);
    const { error } = await supabase.from('meal_logs').insert(list);
    setBusy(false);
    if (error) return setErr('No pudimos guardar: ' + error.message);
    setRows(null); await reload();
  }

  return (
    <section className="card space-y-3">
      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Foto de la comida"
        onChange={(e) => onFile(e.target.files?.[0])} />
      {!rows && (
        <button className="btn flex w-full items-center justify-center gap-2" disabled={busy} onClick={() => input.current?.click()}>
          <Camera size={20} aria-hidden />{busy ? 'Analizando tu comida…' : 'Registrar con una foto'}
        </button>)}
      {err && <p role="alert" className="text-sm font-semibold text-berry">{err}</p>}
      {rows && (
        <div className="space-y-3">
          <p className="font-extrabold">Esto es lo que vimos. Revísalo y corrígelo.</p>
          {note && <p className="rounded-2xl bg-mango/20 p-2 text-sm">{note}</p>}
          {rows.map((r) => (
            <div key={r.key} className="space-y-2 rounded-2xl bg-ink/5 p-3">
              <div className="flex items-center gap-2">
                <input aria-label="Nombre del alimento" className="input" value={r.name} onChange={(e) => upd(r.key, { name: e.target.value })} />
                <button aria-label={`Quitar ${r.name}`} className="p-2 text-berry" onClick={() => setRows(rows.filter((x) => x.key !== r.key))}><Trash2 size={18} /></button>
              </div>
              <div className="flex items-center gap-2">
                <input aria-label={`Gramos de ${r.name}`} type="number" className="input w-24" value={r.grams} onChange={(e) => upd(r.key, { grams: e.target.value })} />
                <span>g</span>
                <select aria-label="Alimento del catálogo" className="input" value={r.foodId} onChange={(e) => pickFood(r.key, e.target.value)}>
                  <option value="">Estimado por IA ({Math.round(r.kcal)} kcal/100 g)</option>
                  {foods.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <p className="text-sm text-ink/70">
                {itemKcal(nut(r).kcal, +r.grams || 0)} kcal · {r.foodId ? 'Del catálogo' : 'Valores estimados'} · confianza {r.conf}
              </p>
            </div>))}
          <select aria-label="Agregar alimento" className="input" value="" onChange={(e) => addRow(e.target.value)}>
            <option value="">+ Agregar un alimento que falta…</option>
            {foods.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <p className="font-bold" aria-live="polite">Total: {Math.round(total)} kcal</p>
          <div className="flex gap-2">
            <button className="btn flex-1" disabled={busy} onClick={confirm}>Confirmar y agregar a {mealLabel.toLowerCase()}</button>
            <button className="btn-ghost" onClick={() => setRows(null)}>Descartar</button>
          </div>
        </div>)}
      <p className="text-xs text-ink/60">
        Las porciones por foto son aproximadas: revisa los gramos.{remaining !== null ? ` Te quedan ${remaining} ${remaining === 1 ? 'foto' : 'fotos'} hoy.` : ' Límite: 4 fotos por día.'}
      </p>
    </section>
  );
}
