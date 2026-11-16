import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Locked } from '@/components/locked';
import { durationLabel, rangeLabel } from '@/features/onboarding/steps';
import { useSession } from '@/stores/session';
import type { Level } from '@/types/domain';
import { formatDistanceKm, formatDuration } from '@/utils/format';

const levels: Record<Level, string> = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
};

export function Profile() {
  const mode = useSession((state) => state.mode);
  const name = useSession((state) => state.name);
  const email = useSession((state) => state.email);
  const profile = useSession((state) => state.profile);
  const preferences = useSession((state) => state.preferences);
  const demo = useSession((state) => state.demo);
  const updatePreferences = useSession((state) => state.updatePreferences);
  const loadDemo = useSession((state) => state.loadDemo);
  const clearDemo = useSession((state) => state.clearDemo);
  const signOut = useSession((state) => state.signOut);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  const hasAccount = mode === 'local' || mode === 'remote' || mode === 'firebase';

  return (
    <main className="screen">
      {hasAccount ? (
        <>
          <div>
            <h1>{name ?? 'Perfil'}</h1>
            <p className="muted">{email}</p>
          </div>
          {profile?.plan && typeof profile.age === 'number' ? (
            <>
              <section className="group">
                <Row label="Nível" value={levels[profile.level]} />
                <Row label="Idade" value={rangeLabel('age', profile.age) ?? `${profile.age} anos`} />
                <Row label="Peso" value={rangeLabel('weightKg', profile.weightKg) ?? `${profile.weightKg} kg`} />
                <Row label="Distância atual" value={`${rangeLabel('currentDistanceMeters', profile.currentDistanceMeters) ?? `${formatDistanceKm(profile.currentDistanceMeters, 1)} km`} em ${durationLabel(profile.currentDistanceMeters, profile.currentDurationSeconds) ?? formatDuration(profile.currentDurationSeconds)}`} />
                <Row label="Meta" value={rangeLabel('goalDistanceMeters', profile.goalDistanceMeters) ?? `${formatDistanceKm(profile.goalDistanceMeters, 1)} km`} />
              </section>
              <Link className="btn outline" to="/avaliacao">
                Refazer plano de treino
              </Link>
            </>
          ) : (
            <Locked title="Plano bloqueado" message="Os dados do plano aparecem quando houver um treino vinculado à conta." />
          )}
        </>
      ) : (
        <>
          <Locked title="Conta bloqueada" message="Crie uma conta para o perfil e as corridas acompanharem você em outros aparelhos." />
          <Link className="btn primary" to="/criar-conta">
            Criar conta
          </Link>
          <Link className="btn text" to="/entrar">
            Já tenho conta
          </Link>
        </>
      )}
      <h2>Áudio</h2>
      <section className="group">
        <label className="toggle">
          <span>Orientação por voz</span>
          <input
            type="checkbox"
            checked={preferences.audioEnabled}
            onChange={(event) => void updatePreferences({ ...preferences, audioEnabled: event.target.checked })}
          />
        </label>
        <label className="toggle">
          <span>Vibração</span>
          <input
            type="checkbox"
            checked={preferences.vibrationEnabled}
            onChange={(event) => void updatePreferences({ ...preferences, vibrationEnabled: event.target.checked })}
          />
        </label>
      </section>
      <p className="muted">A voz avisa troca de etapa e quilômetro. O treino continua mesmo com o áudio desligado.</p>
      <h2>Localização</h2>
      <p className="muted">A permissão é pedida ao iniciar uma corrida. Mantenha esta aba aberta: o navegador não mede o percurso com a tela bloqueada.</p>
      {hasAccount ? (
        <>
          <h2>Ajustes</h2>
          <button
            className="btn outline"
            type="button"
            onClick={() => {
              void (demo ? clearDemo() : loadDemo()).then(async () => {
                await queryClient.invalidateQueries();
                setMessage(demo ? 'Exemplo removido.' : 'Exemplo carregado no histórico.');
              });
            }}
          >
            {demo ? 'Remover exemplo' : 'Carregar corredor de exemplo'}
          </button>
          {message ? <p className="muted">{message}</p> : null}
          <button
            className="btn text"
            type="button"
            onClick={() => {
              void signOut().then(() => navigate('/inicio'));
            }}
          >
            Sair
          </button>
        </>
      ) : null}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="row-between">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
