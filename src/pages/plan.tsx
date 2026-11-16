import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Locked } from '@/components/locked';
import { WORKOUT_POINTS as POINTS, currentStageIndex } from '@/features/training/plan';
import { useSession } from '@/stores/session';
import type { PlanWorkout } from '@/types/domain';
import { formatDistanceKm } from '@/utils/format';

export function Plan() {
  const profile = useSession((state) => state.profile);
  const mode = useSession((state) => state.mode);
  const completeWorkout = useSession((state) => state.completeWorkout);
  const hasAccount = mode === 'local' || mode === 'remote' || mode === 'firebase';
  const [error, setError] = useState<string | null>(null);
  const stages = profile?.plan?.stages ?? [];
  const active = stages.length > 0 ? currentStageIndex(profile!) : 0;
  const finished = stages.length > 0 && stages.every((stage) => stage.workouts.every((workout) => workout.completedOn));
  const [selected, setSelected] = useState(active);
  const stage = stages[Math.min(selected, Math.max(0, stages.length - 1))];

  async function mark(workout: PlanWorkout) {
    setError(null);
    try {
      await completeWorkout(workout.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível marcar o treino.');
    }
  }

  if (!profile?.plan || !stage) {
    return (
      <main className="screen">
        <div>
          <p className="brand">SEU PLANO</p>
          <h1>Sua jornada</h1>
        </div>
        <Locked title="Plano bloqueado" message="As perguntas aparecem quando você decidir montar o treino." />
        <Link className="btn primary" to={hasAccount ? '/avaliacao' : '/criar-conta'}>
          {hasAccount ? 'Criar plano' : 'Criar conta'}
        </Link>
      </main>
    );
  }

  const doneCount = stage.workouts.filter((workout) => workout.completedOn).length;
  const remaining = stage.workouts.length - doneCount;
  const stageLocked = !finished && selected > active;
  const nextId = stageLocked ? undefined : stage.workouts.find((workout) => !workout.completedOn)?.id;
  const days = new Set(stages.flatMap((item) => item.workouts.map((workout) => workout.completedOn).filter((day): day is string => Boolean(day)))).size;

  return (
    <main className="screen plan-screen">
      <header className="journey-top">
        <div>
          <p className="brand">SEU PLANO</p>
          <h1>Sua jornada</h1>
        </div>
        <div className="journey-badges">
          <span className="journey-days">
            <Flame />
            {days} {days === 1 ? 'dia' : 'dias'}
          </span>
          <span className="journey-level">Nv. {active + 1}</span>
        </div>
      </header>

      <div className="journey-stages">
        {stages.map((item, index) => {
          const locked = !finished && index > active;
          const done = item.workouts.every((workout) => workout.completedOn);
          const on = item.id === stage.id;
          return (
            <button
              key={item.id}
              className={[on ? 'on' : '', done ? 'done' : '', locked ? 'locked' : ''].filter(Boolean).join(' ') || undefined}
              type="button"
              onClick={() => setSelected(index)}
            >
              {done && !on ? <Check /> : null}
              {locked ? <Lock /> : null}
              Etapa {index + 1}
            </button>
          );
        })}
      </div>

      <section className="journey-head">
        <h2>{finished && selected === stages.length - 1 ? 'Jornada concluída' : stage.title}</h2>
        <div className="journey-medal">
          <div>
            <i style={{ width: `${stage.workouts.length === 0 ? 0 : (doneCount / stage.workouts.length) * 100}%` }} />
          </div>
          <p>{remaining === 0 ? 'Medalha desta etapa' : `${doneCount} de ${stage.workouts.length} treinos · faltam ${remaining} para a medalha`}</p>
          <Trophy />
        </div>
      </section>

      {stageLocked ? <p className="muted">Dá para ver os treinos. O início libera quando a etapa atual terminar.</p> : null}

      <ol className="journey">
        {stage.workouts.map((workout) => {
          const state = workout.completedOn ? 'done' : workout.id === nextId ? 'next' : 'wait';
          const distance = workout.distanceMeters ? `${formatDistanceKm(workout.distanceMeters, 1)} km` : 'Por tempo';
          return (
            <li className={state} key={workout.id}>
              <span className="node" aria-hidden="true">
                {state === 'done' ? <Check /> : null}
              </span>
              <article>
                <header>
                  {state === 'done' ? <em>Concluído</em> : null}
                  {state === 'next' ? <em>Próximo treino</em> : null}
                  <b>+{POINTS[workout.kind]} XP</b>
                </header>
                <h3>
                  {state === 'next' ? <Bolt /> : null}
                  {workout.title}
                </h3>
                {state === 'done' ? null : <p>{workout.objective}</p>}
                <p className="meta">
                  {distance} · {workout.durationMinutes} min
                  {state === 'wait' && !stageLocked ? (
                    <button type="button" onClick={() => void mark(workout)}>
                      <Check /> Marcar como feito
                    </button>
                  ) : null}
                </p>
                {state === 'next' ? (
                  <div className="journey-go">
                    <Link to={`/treino/${workout.id}`}>
                      <Play /> Começar treino
                    </Link>
                    <button type="button" aria-label="Marcar como feito" onClick={() => void mark(workout)}>
                      <Check />
                    </button>
                  </div>
                ) : null}
              </article>
            </li>
          );
        })}
      </ol>
      <Link className="journey-redo" to="/avaliacao">
        Refazer treino
      </Link>
      {error ? <p className="error">{error}</p> : null}
    </main>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5 9.2 17 19 7" />
    </svg>
  );
}

function Lock() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="10" width="12" height="9" rx="2" />
      <path d="M8 10V8a4 4 0 0 1 8 0v2" />
    </svg>
  );
}

function Flame() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3s4 4.2 4 8a4 4 0 0 1-8 0c0-1.4.6-2.6 1.2-3.5C8.2 9.2 7 11.2 7 13.2 7 16.4 9.4 19 12.4 19S18 16.4 18 13.2C18 8.6 12 3 12 3z" />
    </svg>
  );
}

function Trophy() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5.5A2.5 2.5 0 0 0 8 10M16 6h2.5A2.5 2.5 0 0 1 16 10M12 13v3M9 20h6M10 17h4" />
    </svg>
  );
}

function Bolt() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </svg>
  );
}

function Play() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6.5v11l10-5.5z" />
    </svg>
  );
}
