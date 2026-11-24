import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { CalendarDays, PlusCircle, LineChart, User } from 'lucide-react';
import { supabase } from './lib/supabase';
import { useAppData } from './lib/data';
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import Today from './pages/Today';
import Log from './pages/Log';
import Progress from './pages/Progress';
import Profile from './pages/Profile';

const TABS = [
  { id: 'hoy', label: 'Hoy', Icon: CalendarDays }, { id: 'registrar', label: 'Registrar', Icon: PlusCircle },
  { id: 'progreso', label: 'Progreso', Icon: LineChart }, { id: 'perfil', label: 'Perfil', Icon: User },
] as const;

function Skeleton() {
  return <div className="mx-auto max-w-2xl space-y-3 p-4"><div className="skeleton h-40" /><div className="skeleton h-28" /><div className="skeleton h-28" /></div>;
}

function Main({ userId }: { userId: string }) {
  const { data, reload, error } = useAppData(userId);
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('hoy');
  if (error) return (
    <main className="mx-auto max-w-md space-y-3 p-6">
      <h1 className="text-xl font-extrabold">No pudimos cargar tus datos</h1>
      <p className="rounded-2xl bg-berry/10 p-3 text-sm">{error}</p>
      <p className="text-sm text-ink/70">Revisa que hayas ejecutado schema.sql, seed.sql y los permisos (GRANT) en Supabase.</p>
      <div className="flex gap-2"><button className="btn" onClick={() => reload()}>Reintentar</button>
        <button className="btn-ghost" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button></div>
    </main>);
  if (!data) return <Skeleton />;
  if (!data.profile.onboarded) return <Onboarding userId={userId} data={data} reload={reload} />;
  const props = { userId, data, reload };
  return (
    <div className="min-h-screen md:pl-56">
      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-ink/10 bg-white p-1 md:inset-y-0 md:right-auto md:w-56 md:flex-col md:justify-start md:gap-1 md:border-r md:border-t-0 md:p-3">
        <div className="mb-4 hidden items-center gap-2 px-3 pt-2 md:flex"><img src="/panda.png" alt="" className="h-10 w-10 rounded-full" /><span className="text-xl font-extrabold"><span className="text-mango">Munchi</span><span className="text-leaf">Bit</span></span></div>
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-3 py-2 text-xs font-bold md:flex-none md:flex-row md:gap-3 md:text-base ${tab === id ? 'bg-leaf/10 text-leaf' : 'text-ink/70'}`}>
            <Icon size={22} aria-hidden />{label}</button>))}
      </nav>
      <main className="mx-auto max-w-2xl p-4 pb-28 md:pb-8">
        {tab === 'hoy' && <Today {...props} goTo={setTab} />}
        {tab === 'registrar' && <Log {...props} />}
        {tab === 'progreso' && <Progress {...props} />}
        {tab === 'perfil' && <Profile {...props} />}
      </main>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((ev, s) => {
      setSession(s);
      if (ev === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <Skeleton />;
  if (!session || recovery) return <Auth recovery={recovery} onDone={() => setRecovery(false)} />;
  return <Main userId={session.user.id} />;
}
