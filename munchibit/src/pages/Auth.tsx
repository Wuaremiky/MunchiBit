import { useState } from 'react';
import { supabase } from '../lib/supabase';

type Mode = 'login' | 'signup' | 'forgot';

export default function Auth({ recovery, onDone }: { recovery: boolean; onDone: () => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null); setMsg(null);
    try {
      if (recovery) {
        const { error } = await supabase.auth.updateUser({ password: pw });
        if (error) throw error;
        onDone();
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { data: { name } } });
        if (error) throw error;
        if (!data.session) setMsg('Te enviamos un correo para confirmar tu cuenta.');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setMsg('Revisa tu correo: te enviamos el enlace para crear una nueva contraseña.');
      }
    } catch (x) {
      setErr('No pudimos completar la acción: ' + (x as Error).message);
    } finally { setBusy(false); }
  }

  const title = recovery ? 'Crea tu nueva contraseña' : mode === 'login' ? 'Inicia sesión' : mode === 'signup' ? 'Crea tu cuenta' : 'Recupera tu contraseña';
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <div className="flex flex-col items-center">
        <h1 className="sr-only">MunchiBit</h1>
        <img src="/logo.png" alt="MunchiBit" width={700} height={583} className="w-60 rounded-3xl" />
        <p className="mt-1 text-ink/70">Cuenta calorías sin culpa</p></div>
      <form onSubmit={submit} className="card space-y-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {mode === 'signup' && !recovery && (<div><label className="label" htmlFor="n">Nombre</label>
          <input id="n" className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>)}
        {!recovery && (<div><label className="label" htmlFor="e">Correo</label>
          <input id="e" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></div>)}
        {(mode !== 'forgot' || recovery) && (<div><label className="label" htmlFor="p">{recovery ? 'Nueva contraseña' : 'Contraseña'}</label>
          <input id="p" type="password" minLength={6} className="input" value={pw} onChange={(e) => setPw(e.target.value)} required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></div>)}
        {err && <p role="alert" className="text-sm font-semibold text-berry">{err}</p>}
        {msg && <p role="status" className="text-sm font-semibold text-leaf">{msg}</p>}
        <button className="btn w-full" disabled={busy}>{recovery ? 'Guardar contraseña' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Crear cuenta' : 'Enviar enlace'}</button>
        {!recovery && (
          <div className="flex flex-wrap justify-between gap-2 text-sm font-semibold text-leaf">
            {mode !== 'login' && <button type="button" onClick={() => setMode('login')}>Ya tengo cuenta</button>}
            {mode !== 'signup' && <button type="button" onClick={() => setMode('signup')}>Crear cuenta</button>}
            {mode !== 'forgot' && <button type="button" onClick={() => setMode('forgot')}>Olvidé mi contraseña</button>}
          </div>)}
      </form>
    </main>
  );
}
