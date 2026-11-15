import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Locked } from '@/components/locked';
import { buildPlan, expandSteps } from '@/features/training/plan';
import { useSession } from '@/stores/session';
import type { RuntimeStep, WorkoutType } from '@/types/domain';
import { formatClock, formatDayMonth, formatDistanceKm, formatMeters, formatPace } from '@/utils/format';

const TYPE_LABEL: Record<WorkoutType, string> = {
  easy: 'RODAGEM',
  intervals: 'QUALIDADE',
  progressive: 'PROGRESSIVO',
  long: 'LONGA',
  recovery: 'RECUPERAÇÃO',
  rest: 'DESCANSO',
};

export function Workout() {
  const { sessionId = '' } = useParams();
  const profile = useSession((state) => state.profile);
  const session = useMemo(() => (profile ? buildPlan(profile).find((item) => item.id === sessionId) ?? null : null), [profile, sessionId]);
  const steps = session ? expandSteps(session.steps) : [];

  if (!profile) {
    return (
      <main className="screen plain">
        <Link className="back" to="/plano">
          Treinos
        </Link>
        <Locked title="Treino bloqueado" message="O detalhe do treino abre quando houver um plano de corrida." />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="screen plain">
        <Link className="back" to="/plano">
          Treinos
        </Link>
        <p className="muted">Esse treino não está no plano atual.</p>
      </main>
    );
  }

  const pace = steps.find((step) => step.targetPaceSecondsPerKm)?.targetPaceSecondsPerKm ?? null;
  const estimatedSeconds = steps.reduce((total, step) => {
    if (step.target.type === 'time') return total + step.target.seconds;
    if (!step.targetPaceSecondsPerKm) return total;
    return total + Math.round((step.target.meters / 1000) * step.targetPaceSecondsPerKm);
  }, 0);

  return (
    <main className="screen plain">
      <Link className="back" to="/plano">
        Treinos
      </Link>
      <div>
        <p className="eyebrow">
          {TYPE_LABEL[session.type]} · {formatDayMonth(session.date).toUpperCase()}
        </p>
        <h1>{session.title}</h1>
        <p className="muted">{session.objective}</p>
      </div>
      <section className="metrics dark">
        <Brief value={session.distanceMeters ? formatDistanceKm(session.distanceMeters, 1) : '—'} unit="KM" label="DISTÂNCIA" />
        <Brief value={pace ? formatPace(pace) : '—'} unit="/KM" label="RITMO ALVO" />
        <Brief value={estimatedSeconds ? formatClock(estimatedSeconds).replace(/^00:/, '') : '—'} label="TEMPO" />
      </section>
      <p className="section-label">ETAPAS</p>
      <ol className="steps">
        {steps.map((step, index) => (
          <li key={step.id}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div>
              <strong>{step.label}</strong>
              <p className="muted">{step.detail}</p>
              <p className="step-meta">
                {step.target.type === 'distance' ? formatMeters(step.target.meters) : `${Math.round(step.target.seconds / 60)} min`}
                {targetTime(step) ? ` · ALVO ${targetTime(step)}` : ''}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <section className="cue">
        <p className="eyebrow">COMO EXECUTAR</p>
        <p>{steps[0]?.cue ?? session.objective}</p>
      </section>
      <Link className="btn primary" to={`/treino/${session.id}/guiado`}>
        Começar treino
      </Link>
    </main>
  );
}

function Brief({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div>
      <p className="metric-value light">
        {value}
        {unit ? <small>{unit}</small> : null}
      </p>
      <p className="metric-label light">{label}</p>
    </div>
  );
}

function targetTime(step: RuntimeStep): string | null {
  if (step.target.type !== 'distance' || !step.targetPaceSecondsPerKm) return null;
  const seconds = Math.round((step.target.meters / 1000) * step.targetPaceSecondsPerKm);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
