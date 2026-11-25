import { useEffect, useRef, useState } from 'react';
import { Camera, Mic, PenLine, Square, Trash2 } from 'lucide-react';
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

export default function AiMeal({ userId, foods, meal, mealLabel, reload }:
  { userId: string; foods: Food[]; meal: MealType; mealLabel: string; reload: () => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [note, setNote] = useState('');
  const [info, setInfo] = useState('');
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const rec = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const SR = typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition // eslint-disable-line @typescript-eslint/no-explicit-any
    : null;
  useEffect(() => () => rec.current?.stop(), []);

  /** Dictado: el navegador transcribe la voz a texto; tú lo revisas y recién ahí pulsas "Analizar texto". */
  function toggleMic() {
    if (listening) { rec.current?.stop(); return; }
    const r = new SR();
    r.lang = 'es-CL'; r.interimResults = true; r.continuous = true;
    const base = text.trim() ? text.trim() + ' ' : '';
    r.onresult = (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setText((base + t).slice(0, 600));
    };
    r.onerror = (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      setListening(false);
      setErr(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Permite el acceso al micrófono en tu navegador para dictar.'
        : e.error === 'no-speech' ? 'No escuchamos nada. Inténtalo de nuevo.' : `No pudimos usar el micrófono (${e.error}).`);
    };
    r.onend = () => setListening(false);
    rec.current = r; setErr(null); setListening(true); r.start();
  }

  const nut = (r: Row) => {
    const f = foods.find((x) => x.id === r.foodId);
    return f ? { kcal: f.kcal_100g, p: f.protein_100g, c: f.carbs_100g, f: f.fat_100g } : { kcal: r.kcal, p: r.p, c: r.c, f: r.f };
  };
  const total = (rows ?? []).reduce((s, r) => s + itemKcal(nut(r).kcal, +r.grams || 0), 0);

  async function run(payload: Record<string, unknown>) {
    rec.current?.stop();
    setBusy(true); setErr(null); setRows(null);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-meal', {
        body: { ...payload, catalog: foods.map((f) => f.name) },
      });
      if (error) {
        let msg = 'La función de análisis no respondió. Revisa que esté desplegada con el nombre analyze-meal.';
        try {
          const b = await (error as unknown as { context: Response }).context.json();
          msg = (b.message ?? msg) + (b.detail ? ` (${b.detail})` : '');
        } catch { /* respuesta sin JSON: función no encontrada o caída */ }
        throw new Error(msg);
      }
      const items = data.items as Item[];
      const left = data.remaining as number | null;
      setInfo(left === null ? '' : `Te quedan ${left} ${data.mode === 'text' ? (left === 1 ? 'consulta de texto' : 'consultas de texto') : (left === 1 ? 'foto' : 'fotos')} hoy.`);
      setNote(data.note ?? '');
      if (!items.length) { setErr(data.note || 'No encontramos comida en lo que enviaste.'); return; }
      setRows(items.map((it, i) => {
        const f = foods.find((x) => norm(x.name) === norm(it.match ?? it.name));
        return { key: i, name: f?.name ?? it.name, grams: String(it.grams), foodId: f?.id ?? '', kcal: it.kcal_100g, p: it.protein_100g, c: it.carbs_100g, f: it.fat_100g, conf: it.confidence };
      }));
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }
  async function onFile(file?: File) {
    if (!file) return;
    try { await run({ image: await shrink(file), mediaType: 'image/jpeg' }); }
    catch { setErr('No pudimos leer esa imagen. Prueba con otra foto.'); }
    if (input.current) input.current.value = '';
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
    setRows(null); setText(''); await reload();
  }

  return (
    <section className="card space-y-3">
      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Foto de la comida"
        onChange={(e) => onFile(e.target.files?.[0])} />
      {!rows && (<>
        <button className="btn flex w-full items-center justify-center gap-2" disabled={busy} onClick={() => input.current?.click()}>
          <Camera size={20} aria-hidden />{busy ? 'Analizando tu comida…' : 'Registrar con una foto'}
        </button>
        <div className="space-y-2">
          <label className="label" htmlFor="ai-text">…o cuéntanos qué comiste</label>
          <div className="flex items-start gap-2">
            <textarea id="ai-text" rows={2} maxLength={600} className="input" value={text} onChange={(e) => setText(e.target.value)}
              placeholder="Ej: hoy comí crema de lentejas, 200 g en total, y un pan" />
            {SR && (
              <button type="button" onClick={toggleMic} aria-pressed={listening} disabled={busy}
                aria-label={listening ? 'Detener dictado' : 'Dictar con el micrófono'}
                className={`shrink-0 rounded-2xl p-3 font-bold transition active:scale-95 ${listening ? 'animate-pulse bg-berry text-white' : 'bg-leaf text-white'}`}>
                {listening ? <Square size={20} aria-hidden /> : <Mic size={20} aria-hidden />}
              </button>)}
          </div>
          <p className="text-xs text-ink/60" aria-live="polite">
            {listening ? 'Escuchando… habla y toca el cuadrado cuando termines.'
              : SR ? 'Toca el micrófono, cuéntanos qué comiste y revisa el texto antes de analizar.'
              : 'Tu navegador no permite dictar por voz; escribe con el teclado.'}
          </p>
          <button className="btn-ghost flex w-full items-center justify-center gap-2" disabled={busy || text.trim().length < 3}
            onClick={() => run({ text })}><PenLine size={18} aria-hidden />Analizar texto</button>
        </div></>)}
      {err && <p role="alert" className="text-sm font-semibold text-berry">{err}</p>}
      {rows && (
        <div className="space-y-3">
          <p className="font-extrabold">Esto es lo que entendimos. Revísalo y corrígelo.</p>
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
        Las porciones estimadas son aproximadas: revisa los gramos. {info || 'Límite diario: 4 fotos y 8 consultas de texto.'}
      </p>
    </section>
  );
}
