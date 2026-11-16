import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Locked } from '@/components/locked';
import { WORKOUT_LABEL, WORKOUT_POINTS, findWorkout, intervalCount, stageIsOpen, workoutTimeline } from '@/features/training/plan';
import type { TimelineKind } from '@/features/training/plan';
import { primeLocation } from '@/services/location';
import { useSession } from '@/stores/session';
import { formatDayMonth, formatDistanceKm } from '@/utils/format';

export function Workout() {
  const { sessionId = '' } = useParams();
  const profile = useSession((state) => state.profile);
  const workout = useMemo(() => (profile?.plan ? findWorkout(profile, sessionId) : null), [profile, sessionId]);
  const timeline = useMemo(() => (workout ? workoutTimeline(workout) : []), [workout]);

  if (!profile?.plan) {
    return (
      <main className="plan-detail">
        <BackToPlan />
        <Locked title="Treino bloqueado" message="O detalhe do treino abre quando houver um plano de corrida." />
      </main>
    );
  }

  if (!workout) {
    return (
      <main className="plan-detail">
        <BackToPlan />
        <p className="muted">Esse treino não está no plano atual.</p>
      </main>
    );
  }

  const stageIndex = profile.plan.stages.findIndex((stage) => stage.workouts.some((item) => item.id === workout.id));
  const open = stageIsOpen(profile, stageIndex);
  const done = Boolean(workout.completedOn);
  const reps = intervalCount(workout);
  const blocks = timeline.filter((item) => item.kind !== 'rest').length;

  return (
    <main className="plan-detail mission-screen">
      <header className="mission-top">
        <BackToPlan />
        <span className="journey-level">+{WORKOUT_POINTS[workout.kind]} XP</span>
      </header>

      <section className={done ? 'mission-hero done' : 'mission-hero'}>
        <header>
          <em>{WORKOUT_LABEL[workout.kind]}</em>
          {done ? (
            <b>
              <Check /> Feito em {formatDayMonth(workout.completedOn!)}
            </b>
          ) : null}
        </header>
        <h1>
          {done ? null : <Bolt />}
          {workout.title}
        </h1>
        <p>{workout.objective}</p>
        <div className="mission-stats">
          <span>
            <strong>{workout.distanceMeters ? formatDistanceKm(workout.distanceMeters, 1) : '—'}</strong> km
          </span>
          <span>
            <strong>{workout.durationMinutes}</strong> min
          </span>
          {reps > 0 ? (
            <span>
              <strong>{reps}</strong> {reps === 1 ? 'tiro' : 'tiros'}
            </span>
          ) : null}
        </div>
      </section>

      <div className="mission-head">
        <h2>Passo a passo</h2>
        <span>{blocks} blocos</span>
      </div>

      <ol className="mission">
        {timeline.map((item) =>
          item.kind === 'rest' ? (
            <li key={item.id} className="rest">
              <span className="node" aria-hidden="true" />
              <div className="mission-rest">
                <p>
                  <Pause />
                  <b>{item.tag}</b>
                  <span>
                    {item.headline} · {item.target}
                  </span>
                </p>
                {item.detail ? <small>{item.detail}</small> : null}
              </div>
            </li>
          ) : (
            <li key={item.id} className={item.kind}>
              <span className="node" aria-hidden="true">
                <NodeIcon kind={item.kind} />
              </span>
              <article>
                <em>{item.tag}</em>
                <div className="mission-line">
                  <strong>{item.headline}</strong>
                  {item.target ? <b>{item.target}</b> : null}
                </div>
                {item.detail ? <p>{item.detail}</p> : null}
              </article>
            </li>
          ),
        )}
        <li className="finish">
          <span className="node" aria-hidden="true">
            <Trophy />
          </span>
          <p>
            Treino completo <b>+{WORKOUT_POINTS[workout.kind]} XP</b>
          </p>
        </li>
      </ol>

      {open ? (
        <div className="mission-cta">
          <Link className="btn primary" to={`/treino/${workout.id}/guiado`} onClick={() => primeLocation()}>
            <Play /> {done ? 'Correr de novo' : 'Começar treino'}
          </Link>
        </div>
      ) : (
        <p className="muted">Dá para ver o treino. O início libera quando a etapa atual terminar.</p>
      )}
    </main>
  );
}

function NodeIcon({ kind }: { kind: TimelineKind }) {
  if (kind === 'work') return <Bolt />;
  if (kind === 'steady') return <Play />;
  return null;
}

function BackToPlan() {
  return (
    <Link className="back" to="/plano">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.5 6 8.5 12l6 6" />
      </svg>
      Voltar
    </Link>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="stroke">
      <path d="M5 12.5 9.2 17 19 7" />
    </svg>
  );
}

function Bolt() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="fill">
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </svg>
  );
}

function Play() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="fill">
      <path d="M8 6.5v11l10-5.5z" />
    </svg>
  );
}

function Pause() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="stroke">
      <path d="M9 7v10M15 7v10" />
    </svg>
  );
}

function Trophy() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="stroke">
      <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5.5A2.5 2.5 0 0 0 8 10M16 6h2.5A2.5 2.5 0 0 1 16 10M12 13v3M9 20h6M10 17h4" />
    </svg>
  );
}
