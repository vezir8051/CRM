import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CircleAlert } from 'lucide-react';
import { login, useCurrentUser } from '@/store/session';
import { toast } from '@/store/ui';
import { Button, Field, Input } from '@/components/ui';

export default function LoginPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (user) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await login(username, password);
    setBusy(false);
    if (ok) navigate(from, { replace: true });
    else {
      setError(true);
      setPassword('');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0e1c31] p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_480px_at_85%_-10%,#1e3a8a_0%,transparent_60%),radial-gradient(800px_480px_at_-10%_110%,#1d4ed8_0%,transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,.05)_1px,transparent_1px)] bg-[length:26px_26px]" />
      <div className="relative w-full max-w-[400px]">
        <div className="rounded-2xl border border-line bg-surface px-9 pb-7 pt-9 shadow-pop">
          <div className="mb-7 flex flex-col items-center gap-3 text-center">
            <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[13px] bg-gradient-to-br from-blue-500 to-blue-700 text-2xl font-bold text-white shadow-[0_6px_18px_rgba(37,99,235,.45)]">P</div>
            <div>
              <h1 className="text-[21px] font-bold">PersoCRM</h1>
              <p className="text-[13px] text-muted">Personalvermittlung & Personalverleih</p>
            </div>
          </div>
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
              <CircleAlert size={16} /> Benutzername oder Passwort ist ungültig.
            </div>
          )}
          <form onSubmit={submit} className="space-y-3.5">
            <Field label="Benutzername">
              <Input id="login-username" autoComplete="username" required autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
            </Field>
            <Field label="Passwort">
              <Input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Button type="submit" variant="primary" loading={busy} className="!mt-5 h-10 w-full">
              Anmelden
            </Button>
          </form>
          <button type="button" className="mx-auto mt-4 block text-[13px] text-brand hover:underline" onClick={() => toast.info('Demo-Modus: Bitte «admin» / «admin» verwenden.')}>
            Passwort vergessen?
          </button>
          <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-blue-900 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200">
            <strong>Demo-Zugang:</strong> <code>admin</code> / <code>admin</code> (Administrator) oder <code>mmueller</code> / <code>demo</code> (Berater)
          </div>
        </div>
        <p className="mt-5 text-center text-xs text-slate-400">© 2026 PersoCRM · Daten werden lokal im Browser gespeichert</p>
      </div>
    </div>
  );
}
