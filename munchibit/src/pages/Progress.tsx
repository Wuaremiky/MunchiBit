import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '../lib/supabase';
import { fmt, iso } from '../lib/dates';
import { estimateGoalDate } from '../lib/calc';
import { plateau, summarize, weeklyPatterns } from '../lib/recommendations';
import CardList from '../components/CardList';
import type { Props } from '../types';

export default function Progress({ userId, data, reload }: Props) {
  const p = data.profile, today = iso();
  const [w, setW] = useState('');
  const sums = summarize(data, 14, today);
  const goalDate = p.goal_weight_kg ? estimateGoalDate(data.weights, p.goal_weight_kg, today) : null;
  const pl = plateau(data.weights, sums, today);
  const cards = [...(pl ? [pl] : []), ...weeklyPatterns(sums, p.daily_kcal ?? 2000, p.water_goal)];
  const last = data.weights[data.weights.length - 1], first = data.weights[0];

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!+w) return;
    await supabase.from('weight_logs').upsert({ user_id: userId, date: today, weight_kg: +w }, { onConflict: 'user_id,date' });
    setW(''); await reload();
  }
  return (
    <div className="space-y-4">
      <form onSubmit={save} className="card flex items-end gap-2">
        <div className="flex-1"><label className="label" htmlFor="w">Peso de hoy (kg)</label>
          <input id="w" type="number" step="0.1" className="input" value={w} onChange={(e) => setW(e.target.value)} placeholder={last ? String(last.weight_kg) : ''} /></div>
        <button className="btn">Guardar</button>
      </form>
      <section className="card">
        <h2 className="font-extrabold">Tendencia de peso</h2>
        {data.weights.length < 2 ? <p className="py-6 text-ink/70">Registra tu peso al menos 2 veces para ver tu gráfico.</p> : (
          <div className="h-56" role="img" aria-label="Gráfico de peso">
            <ResponsiveContainer><LineChart data={data.weights} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2A2E1A" />
              <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} fontSize={11} />
              <YAxis domain={['dataMin - 1', 'dataMax + 1']} fontSize={11} />
              <Tooltip labelFormatter={(d: string) => fmt(d)} formatter={(v: number) => [`${v} kg`, 'Peso']} />
              {p.goal_weight_kg && <ReferenceLine y={p.goal_weight_kg} stroke="#12806F" strokeDasharray="5 5" label={{ value: 'Meta', fontSize: 11 }} />}
              <Line type="monotone" dataKey="weight_kg" stroke="#D6455D" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart></ResponsiveContainer></div>)}
        {last && first && <p className="mt-2 text-sm font-semibold">{last.weight_kg} kg ahora · {(last.weight_kg - first.weight_kg).toFixed(1)} kg desde el inicio</p>}
        <p className="mt-1 text-sm">{goalDate ? (goalDate === today ? '¡Llegaste a tu peso meta!' : `A este ritmo llegarías a tu meta hacia el ${fmt(goalDate)}.`) : 'Con más registros semanales estimaremos tu fecha meta.'}</p>
      </section>
      <h2 className="text-xl font-extrabold">Resumen semanal</h2>
      <CardList cards={cards} userId={userId} reload={reload} profile={p} />
    </div>
  );
}
