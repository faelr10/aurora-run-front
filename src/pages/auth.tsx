import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Logo } from '@/components/logo';
import { loginSchema, registerSchema } from '@/features/onboarding/schema';
import { firebaseConfigured } from '@/services/firebase/app';
import { useSession } from '@/stores/session';

export function Welcome() {
  return (
    <main className="screen auth-screen">
      <div className="auth-brand">
        <Logo size={96} />
        <p className="brand">AURORA RUN</p>
      </div>
      <h1>Corrida com plano, ritmo e mapa.</h1>
      <p className="muted">O treino fica neste aparelho. A distância só entra quando o GPS é preciso.</p>
      <div className="pin">
        <Link className="btn primary" to="/criar-conta">
          Começar
        </Link>
        <Link className="btn text" to="/entrar">
          Já tenho conta
        </Link>
      </div>
    </main>
  );
}

export function Login() {
  const login = useSession((state) => state.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Confira os dados.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await login(parsed.data);
      navigate('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="screen auth-screen">
      <Link className="back" to="/perfil">
        Voltar
      </Link>
      <header className="auth-intro">
        <Logo size={64} />
        <p className="eyebrow">Conta</p>
        <h1>Entrar</h1>
        <p className="muted">Use o e-mail da sua conta para recuperar perfil e corridas.</p>
      </header>
      <form className="form" onSubmit={(event) => void submit(event)}>
        <label>
          E-mail
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Senha
          <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? 'Entrando' : 'Entrar'}
        </button>
        <Link className="btn text" to="/criar-conta">
          Criar conta
        </Link>
      </form>
    </main>
  );
}

export function Register() {
  const register = useSession((state) => state.register);
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = registerSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Confira os dados.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await register(parsed.data);
      navigate('/inicio');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar a conta.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="screen auth-screen">
      <Link className="back" to="/perfil">
        Voltar
      </Link>
      <header className="auth-intro">
        <Logo size={64} />
        <p className="eyebrow">Conta</p>
        <h1>Criar conta</h1>
        <p className="muted">
          {firebaseConfigured()
            ? 'O perfil e as corridas acompanham você em outros aparelhos.'
            : 'Sem o Firebase configurado, a conta fica só neste navegador.'}
        </p>
      </header>
      <form className="form" onSubmit={(event) => void submit(event)}>
        <label>
          Nome
          <input autoComplete="name" placeholder="Seu nome" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          E-mail
          <input type="email" autoComplete="email" placeholder="voce@email.com" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Senha
          <input type="password" autoComplete="new-password" placeholder="Mínimo de 8 caracteres" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? 'Criando' : 'Criar conta'}
        </button>
        <Link className="btn text" to="/entrar">
          Já tenho conta
        </Link>
      </form>
    </main>
  );
}
