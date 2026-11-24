import { useState } from 'react';
import Mascot from '../components/Mascot';
import { Activity_, Body, Goal, Identity } from '../components/ProfileFields';
import { formFromProfile, saveProfile, previewTargets, validate } from '../lib/data';
import type { Props } from '../types';

const STEPS = ['¿Cómo te llamas?', 'Cuéntanos sobre ti', '¿Cuánto te mueves?', 'Tu objetivo'];

export default function Onboarding({ userId, data, reload }: Props) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState(formFromProfile(data.profile));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ok = [f.name.trim() !== '', !!f.sex && +f.age > 0 && +f.height > 0 && +f.weight > 0 && !validate(f), !!f.activity, !!previewTargets(f)][step];

  async function next() {
    if (step < 3) return setStep(step + 1);
    setBusy(true); setErr(null);
    try { await saveProfile(userId, f); await reload(); } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <div className="flex items-center gap-3"><Mascot mood="feliz" size={90} />
        <div><p className="text-sm font-semibold text-ink/60">Paso {step + 1} de 4</p><h1 className="text-2xl font-extrabold">{STEPS[step]}</h1></div></div>
      <div className="h-2 rounded-full bg-ink/10"><div className="h-2 rounded-full bg-leaf transition-all" style={{ width: `${(step + 1) * 25}%` }} /></div>
      <div className="card">{[<Identity f={f} set={setF} />, <Body f={f} set={setF} />, <Activity_ f={f} set={setF} />, <Goal f={f} set={setF} />][step]}</div>
      {validate(f) && <p role="alert" className="font-semibold text-berry">{validate(f)}</p>}
      {err && <p role="alert" className="font-semibold text-berry">{err}</p>}
      <div className="flex gap-2">
        {step > 0 && <button className="btn-ghost" onClick={() => setStep(step - 1)}>Atrás</button>}
        <button className="btn flex-1" disabled={!ok || busy} onClick={next}>{step < 3 ? 'Continuar' : 'Empezar'}</button>
      </div>
    </main>
  );
}
