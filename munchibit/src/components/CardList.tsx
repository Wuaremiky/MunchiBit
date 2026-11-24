import { useState } from 'react';
import { Lightbulb, ShieldAlert, PartyPopper } from 'lucide-react';
import type { Card } from '../lib/recommendations';
import type { Profile } from '../types';
import { formFromProfile, saveProfile } from '../lib/data';
import { supabase } from '../lib/supabase';

const ICON = { info: Lightbulb, warn: ShieldAlert, success: PartyPopper };
const TONE = { info: 'bg-sky/10', warn: 'bg-mango/20', success: 'bg-leaf/10' };

export default function CardList({ cards, userId, reload, profile }: { cards: Card[]; userId: string; reload: () => Promise<void>; profile: Profile }) {
  const [busy, setBusy] = useState(false);
  async function recalc() {
    setBusy(true);
    const { data } = await supabase.from('weight_logs').select('weight_kg').order('date', { ascending: false }).limit(1);
    const w = data?.[0]?.weight_kg;
    if (w) await saveProfile(userId, { ...formFromProfile(profile), weight: String(w) });
    await reload(); setBusy(false);
  }
  return (<>{cards.map((c) => { const I = ICON[c.tone]; return (
    <article key={c.id} className={`rounded-3xl p-4 ${TONE[c.tone]}`}>
      <h3 className="flex items-center gap-2 font-extrabold"><I size={18} aria-hidden />{c.title}</h3>
      <p className="mt-1">{c.body}</p>
      {c.action === 'recalc' && <button className="btn mt-3" disabled={busy} onClick={recalc}>Recalcular con mi peso actual</button>}
    </article>); })}</>);
}
