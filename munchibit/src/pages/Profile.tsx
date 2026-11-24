import { useState } from 'react';
import { Activity_, Body, Goal, Identity } from '../components/ProfileFields';
import { formFromProfile, saveProfile } from '../lib/data';
import { supabase } from '../lib/supabase';
import type { Props } from '../types';

export default function Profile({ userId, data, reload }: Props) {
  const [f, setF] = useState(formFromProfile(data.profile));
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setMsg(null);
    try { await saveProfile(userId, f); await reload(); setMsg('Guardado. Tus metas se recalcularon y tu historial sigue intacto.'); }
    catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Perfil y metas</h1>
      <section className="card"><Identity f={f} set={setF} /></section>
      <section className="card"><Body f={f} set={setF} /></section>
      <section className="card"><h2 className="mb-2 font-extrabold">Actividad física</h2><Activity_ f={f} set={setF} /></section>
      <section className="card"><Goal f={f} set={setF} /></section>
      {msg && <p role="status" className="font-semibold text-leaf">{msg}</p>}
      <button className="btn w-full" disabled={busy} onClick={save}>Guardar y recalcular</button>
      <button className="btn-ghost w-full" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
    </div>
  );
}
