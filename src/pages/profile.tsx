import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Locked } from '@/components/locked';
import { useSession } from '@/stores/session';
import type { Level } from '@/types/domain';
import { formatDistanceKm } from '@/utils/format';

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

  const hasAccount = mode === 'local' || mode === 'remote';

  return (
    <main className="screen">
      {hasAccount ? (
        <>
          <div>
            <h1>{name ?? 'Perfil'}</h1>
            <p className="muted">{email}</p>
          </div>
          {profile ? (
            <section className="group">
              <Row label="Nível" value={levels[profile.level]} />
              <Row label="Distância atual" value={`${formatDistanceKm(profile.currentDistanceMeters, 0)} km`} />
              <Row label="Objetivo" value={`${formatDistanceKm(profile.goalDistanceMeters, 0)} km`} />
              <Row label="Frequência" value={`${profile.weeklyFrequency}x por semana`} />
            </section>
          ) : (
            <Locked title="Plano bloqueado" message="Os dados do plano aparecem quando houver um treino vinculado à conta." />
          )}
        </>
      ) : (
        <Locked title="Conta bloqueada" message="O perfil pede uma conta. A corrida fica salva neste aparelho, sem cadastro." />
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
