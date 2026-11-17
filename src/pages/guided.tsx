import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Locked } from '@/components/locked';
import { coachLine, introLine, kilometerLine, paceState } from '@/features/training/coach';
import {
  completeStep,
  recordedStages,
  createEngine,
  finishEngine,
  pauseEngine,
  resumeEngine,
  skip,
  stepProgress,
  stepRemaining,
  tick,
  type StepResult,
} from '@/features/training/engine';
import { WORKOUT_POINTS, findWorkout, formatEffort, stageIsOpen, toRuntimeSteps } from '@/features/training/plan';
import { useLiveActivity } from '@/hooks/use-live-activity';
import { playCue } from '@/services/audio/cues';
import { bindScreenAwake } from '@/services/run-presence';
import { useSession } from '@/stores/session';
import type { RuntimeStep } from '@/types/domain';
import { formatClock, formatDistanceKm, formatMeters, formatPace } from '@/utils/format';

export function Guided() {
  const { sessionId = '' } = useParams();
  const profile = useSession((state) => state.profile);
  if (!profile?.plan) {
    return (
      <main className="screen plain">
        <Link className="back" to="/inicio">
          Início
        </Link>
        <Locked title="Treino bloqueado" message="O treino guiado abre quando houver um plano de corrida." />
      </main>
    );
  }
  const stageIndex = profile.plan.stages.findIndex((stage) => stage.workouts.some((workout) => workout.id === sessionId));
  if (!stageIsOpen(profile, stageIndex)) {
    return (
      <main className="screen plain">
        <Link className="back" to="/plano">
          Plano
        </Link>
        <Locked title="Etapa bloqueada" message="Dá para ver os treinos no plano. O início libera quando a etapa atual terminar." />
      </main>
    );
  }
  return <GuidedRun />;
}

function GuidedRun() {
  const { sessionId = '' } = useParams();
  const profile = useSession((state) => state.profile);
  const preferences = useSession((state) => state.preferences);
  const completeWorkout = useSession((state) => state.completeWorkout);
  const navigate = useNavigate();
  const session = useMemo(() => (profile?.plan ? findWorkout(profile, sessionId) : null), [profile, sessionId]);
  const steps = useMemo(() => (session ? toRuntimeSteps(session) : []), [session]);
  const [engine, setEngine] = useState(createEngine);
  const live = useLiveActivity({
    source: 'guided',
    title: session?.title ?? 'Treino guiado',
    sessionId: session?.id ?? null,
    announceKilometers: false,
  });
  const distanceRef = useRef(0);
  const lastDistance = useRef(0);
  const finished = useRef(false);
  const preferencesRef = useRef(preferences);
  const finishRef = useRef(live.finish);
  const paceRef = useRef(live.currentPace);
  const previous = useRef(engine);
  const spokenKm = useRef(0);
  const step = steps[engine.stepIndex];

  useEffect(() => bindScreenAwake(), []);

  useEffect(() => {
    preferencesRef.current = preferences;
    finishRef.current = live.finish;
    paceRef.current = live.currentPace;
  }, [live.currentPace, live.finish, preferences]);

  useEffect(() => {
    distanceRef.current = live.activity?.distanceMeters ?? 0;
  }, [live.activity?.distanceMeters]);

  useEffect(() => {
    if (steps.length === 0) return;
    say(introLine(steps), preferencesRef.current);
  }, [steps]);

  useEffect(() => {
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const delta = Math.min(120, Math.max(0, (now - last) / 1000));
      last = now;
      const meters = Math.max(0, distanceRef.current - lastDistance.current);
      lastDistance.current = distanceRef.current;
      setEngine((current) => {
        if (current.status !== 'running' && current.status !== 'countdown') return current;
        return tick(current, steps, delta, current.status === 'running' ? meters : 0);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [steps]);

  useEffect(() => {
    const prev = previous.current;
    previous.current = engine;
    if (prev === engine) return;
    const line = coachLine(prev, engine, steps);
    if (line) {
      say(line, preferencesRef.current);
      return;
    }
    const km = Math.floor(distanceRef.current / 1000);
    const current = steps[engine.stepIndex];
    if (km > spokenKm.current) {
      spokenKm.current = km;
      if (engine.status === 'running' && current?.kind !== 'work') say(kilometerLine(km, paceRef.current), preferencesRef.current);
    }
  }, [engine, steps]);

  useEffect(() => {
    if (engine.status !== 'finished' || finished.current) return;
    finished.current = true;
    const completedAll = engine.results.length >= steps.length;
    void finishRef.current(recordedStages(steps, engine)).then(async (activity) => {
      if (completedAll && session?.id) await completeWorkout(session.id, activity?.clientId).catch(() => undefined);
      if (!activity) {
        navigate(session ? `/treino/${session.id}` : '/plano', { replace: true });
        return;
      }
      navigate(`/atividade/${activity.clientId}/concluida`, { replace: true });
    });
  }, [completeWorkout, engine.results.length, engine.status, navigate, session, steps.length]);

  if (!session || !step) {
    return (
      <main className="screen plain">
        <button className="back" type="button" onClick={() => void live.abandon().then(() => navigate(-1))}>
          Voltar
        </button>
        <p className="muted">Não encontrei essa sessão no plano.</p>
      </main>
    );
  }

  const paused = engine.status === 'paused';
  const counting = engine.status === 'countdown' || (paused && engine.resumeTo === 'countdown');
  const remaining = stepRemaining(step, engine);
  const remainingLabel = step.target.type === 'time' ? shortClock(remaining) : formatMeters(remaining);
  const following = steps[engine.stepIndex + 1];
  const upcoming = !counting && step.target.type === 'time' && remaining <= 10 && following?.kind === 'work' ? Math.ceil(remaining) : null;
  const pace = paceState(step, engine);
  const hits = engine.results.filter((result) => result.onTarget === true).length;
  const works = steps.filter((item) => item.kind === 'work').length;
  const gpsMissing = step.target.type === 'distance' && (live.permission === 'denied' || live.permission === 'blocked');

  function togglePause() {
    setEngine((current) => (current.status === 'paused' ? resumeEngine(current) : pauseEngine(current)));
    if (paused) void live.resume();
    else void live.pause();
  }

  function endWorkout() {
    if (!window.confirm('Encerrar o treino agora? A corrida fica salva, mas o treino só ganha o check se todas as etapas forem feitas.')) return;
    setEngine((current) => finishEngine(current));
  }

  return (
    <main className="coach">
      <header className="coach-top">
        <button className="back" type="button" onClick={() => void live.abandon().then(() => navigate(-1))}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="stroke">
            <path d="M14.5 6 8.5 12l6 6" />
          </svg>
          Sair
        </button>
        <p>
          Etapa {Math.min(engine.stepIndex + 1, steps.length)} de {steps.length}
        </p>
        <span className="journey-level">+{WORKOUT_POINTS[session.kind]} XP</span>
      </header>

      <div className="coach-segments" aria-hidden="true">
        {steps.map((item, index) => {
          const result = engine.results[index];
          const state = result ? (result.status === 'skipped' ? 'skipped' : result.onTarget === false ? 'missed' : 'done') : index === engine.stepIndex ? 'now' : '';
          return (
            <i key={item.id} className={`${state} ${item.kind}`}>
              {index === engine.stepIndex && !result ? <b style={{ width: `${Math.round(stepProgress(step, engine) * 100)}%` }} /> : null}
            </i>
          );
        })}
      </div>

      {counting ? (
        <section className="coach-card ready">
          <em>Prepare-se</em>
          <h1>{Math.ceil(engine.countdown)}</h1>
          <p className="coach-sub">
            Começa com {step.label.toLowerCase()} · {stepGoal(step)}
          </p>
          <p className="coach-detail">{step.detail}</p>
        </section>
      ) : (
        <section className={`coach-card ${step.kind}${paused ? ' paused' : ''}`}>
          <header>
            <em>{stepTag(step)}</em>
            {paused ? <b>Pausado</b> : null}
          </header>
          <h1>{remainingLabel}</h1>
          <p className="coach-sub">
            {step.target.type === 'time' ? `restante de ${formatEffort(step.target.seconds)}` : `restante de ${formatMeters(step.target.meters)}`}
            {step.goalSeconds && step.target.type === 'distance' ? ` · alvo ${formatEffort(step.goalSeconds)}` : ''}
          </p>
          <div className="coach-bar">
            <span style={{ width: `${Math.round(stepProgress(step, engine) * 100)}%` }} />
          </div>
          {step.kind === 'work' && step.target.type === 'distance' ? (
            <div className="coach-split">
              <p>
                <span>Tempo</span>
                <strong>{formatEffort(engine.stepMovingSeconds)}</strong>
              </p>
              <p>
                <span>Alvo</span>
                <strong>{step.goalSeconds ? formatEffort(step.goalSeconds) : '—'}</strong>
              </p>
              <p className={pace ?? ''}>
                <span>Ritmo</span>
                <strong>{pace === 'behind' ? 'Acelere' : pace === 'ahead' ? 'Segure' : pace === 'on' ? 'No tempo' : '—'}</strong>
              </p>
            </div>
          ) : (
            <p className="coach-detail">{step.kind === 'recovery' ? step.cue : step.detail}</p>
          )}
          {upcoming !== null && following ? (
            <p className="coach-next">
              <Bolt /> {following.label} em <strong>{upcoming}</strong>
            </p>
          ) : null}
        </section>
      )}

      {gpsMissing ? <p className="coach-warning">Sem GPS, a distância não avança. Toque em Concluir etapa quando terminar.</p> : null}

      <div className="live-stats">
        <div>
          <span>Ritmo atual</span>
          <strong>{formatPace(live.currentPace)}</strong>
        </div>
        <div>
          <span>Distância</span>
          <strong>{formatDistanceKm(live.activity?.distanceMeters ?? 0, 2)} km</strong>
        </div>
        <div>
          <span>Tempo</span>
          <strong>{formatClock(live.movingSeconds)}</strong>
        </div>
      </div>

      <section className="coach-list">
        <div className="mission-head">
          <h2>Etapas</h2>
          {works > 0 ? (
            <span>
              {hits} de {works} tiros no tempo
            </span>
          ) : (
            <span>
              {engine.results.filter((result) => result.status === 'done').length} de {steps.length} feitas
            </span>
          )}
        </div>
        <ol>
          {steps.map((item, index) => (
            <StepRow key={item.id} step={item} result={engine.results[index]} current={index === engine.stepIndex && engine.status !== 'finished'} />
          ))}
        </ol>
      </section>

      <div className="coach-actions">
        <div>
          <button className="coach-pause" type="button" onClick={togglePause}>
            {paused ? 'Retomar' : 'Pausar'}
          </button>
          <button className="coach-check" type="button" onClick={() => setEngine((current) => completeStep(current, steps))}>
            <Check /> Concluir etapa
          </button>
        </div>
        <p>
          <button type="button" onClick={() => setEngine((current) => skip(current, steps))}>
            Pular etapa
          </button>
          <button type="button" onClick={endWorkout}>
            Encerrar treino
          </button>
        </p>
      </div>
    </main>
  );
}

function StepRow({ step, result, current }: { step: RuntimeStep; result: StepResult | undefined; current: boolean }) {
  const state = result ? (result.status === 'skipped' ? 'skipped' : result.onTarget === false ? 'missed' : 'done') : current ? 'now' : 'wait';
  return (
    <li className={`${state} ${step.kind}`}>
      <span className="node" aria-hidden="true">
        {state === 'done' || state === 'missed' ? <Check /> : null}
        {state === 'skipped' ? '–' : null}
      </span>
      <p>
        <strong>{stepTag(step)}</strong>
        <span>{rowNote(step, result)}</span>
      </p>
    </li>
  );
}

function rowNote(step: RuntimeStep, result: StepResult | undefined): string {
  if (!result && step.kind === 'recovery' && step.target.type === 'time') return formatEffort(step.target.seconds);
  if (!result) return stepGoal(step);
  if (result.status === 'skipped') return 'pulado';
  const time = formatEffort(result.seconds);
  if (step.kind !== 'work' || result.onTarget === null) {
    return step.target.type === 'distance' && result.meters > 0 ? `${formatMeters(result.meters)} em ${time}` : time;
  }
  if (result.onTarget) return `${time} · no tempo`;
  const over = Math.round(result.seconds - (step.goalSeconds ?? result.seconds));
  if (over > 0) return `${time} · +${over} s`;
  if (step.target.type === 'distance') return `${formatMeters(result.meters)} de ${formatMeters(step.target.meters)}`;
  return time;
}

function stepGoal(step: RuntimeStep): string {
  if (step.target.type === 'distance') {
    return step.goalSeconds ? `${formatMeters(step.target.meters)} em ${formatEffort(step.goalSeconds)}` : formatMeters(step.target.meters);
  }
  const time = formatEffort(step.target.seconds);
  return step.kind === 'recovery' ? `${time} ${step.manner ?? 'caminhando'}` : time;
}

function stepTag(step: RuntimeStep): string {
  if (step.kind === 'work' && step.repeatIndex && step.repeatCount) {
    return `${step.label.replace(/\s+\d+\s+de\s+\d+$/, '')} ${step.repeatIndex}/${step.repeatCount}`;
  }
  if (step.kind === 'recovery') return `Descanso · ${step.manner ?? 'caminhando'}`;
  return step.label;
}

function shortClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

function say(line: string, preferences: { audioEnabled: boolean; vibrationEnabled: boolean }) {
  playCue(line, preferences.audioEnabled, preferences.vibrationEnabled);
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
