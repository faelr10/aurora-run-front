import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Locked } from '@/components/locked';
import { createEngine, pauseEngine, resumeEngine, skip, stepProgress, stepRemaining, tick } from '@/features/training/engine';
import { buildPlan, expandSteps } from '@/features/training/plan';
import { useLiveActivity } from '@/hooks/use-live-activity';
import { playCue } from '@/services/audio/cues';
import { bindScreenAwake } from '@/services/run-presence';
import { useSession } from '@/stores/session';
import { formatClock, formatMeters, formatPace } from '@/utils/format';

export function Guided() {
  const profile = useSession((state) => state.profile);
  if (!profile) {
    return (
      <main className="screen plain">
        <Link className="back" to="/inicio">
          Início
        </Link>
        <Locked title="Treino bloqueado" message="O treino guiado abre quando houver um plano de corrida." />
      </main>
    );
  }
  return <GuidedRun />;
}

function GuidedRun() {
  const { sessionId = '' } = useParams();
  const profile = useSession((state) => state.profile);
  const preferences = useSession((state) => state.preferences);
  const navigate = useNavigate();
  const session = useMemo(() => (profile ? buildPlan(profile).find((item) => item.id === sessionId) ?? null : null), [profile, sessionId]);
  const steps = useMemo(() => (session ? expandSteps(session.steps) : []), [session]);
  const [engine, setEngine] = useState(createEngine);
  const live = useLiveActivity({ source: 'guided', title: session?.title ?? 'Treino guiado', sessionId: session?.id ?? null });
  const distanceRef = useRef(0);
  const lastDistance = useRef(0);
  const finished = useRef(false);
  const preferencesRef = useRef(preferences);
  const finishRef = useRef(live.finish);
  const step = steps[engine.stepIndex];

  useEffect(() => bindScreenAwake(), []);

  useEffect(() => {
    preferencesRef.current = preferences;
    finishRef.current = live.finish;
  }, [live.finish, preferences]);

  useEffect(() => {
    distanceRef.current = live.activity?.distanceMeters ?? 0;
  }, [live.activity?.distanceMeters]);

  useEffect(() => {
    if (!step) return;
    playCue(step.cue, preferencesRef.current.audioEnabled, preferencesRef.current.vibrationEnabled);
  }, [step]);

  useEffect(() => {
    const timer = setInterval(() => {
      setEngine((current) => {
        const delta = Math.max(0, distanceRef.current - lastDistance.current);
        lastDistance.current = distanceRef.current;
        if (current.status !== 'running') return current;
        return tick(current, steps, 1, delta);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [steps]);

  useEffect(() => {
    if (engine.status !== 'finished' || finished.current) return;
    finished.current = true;
    void finishRef.current().then((activity) => {
      if (!activity) return;
      navigate(`/atividade/${activity.clientId}/concluida`, { replace: true });
    });
  }, [engine.status, navigate]);

  if (!session || !step) {
    return (
      <main className="screen plain">
        <button className="back" type="button" onClick={() => navigate(-1)}>
          Voltar
        </button>
        <p className="muted">Não encontrei essa sessão no plano.</p>
      </main>
    );
  }

  const remaining = stepRemaining(step, engine);
  const remainingLabel = step.target.type === 'time' ? formatClock(remaining) : formatMeters(remaining);
  const paused = engine.status === 'paused';

  return (
    <main className="run-screen">
      <section className="stage">
        <button className="back" type="button" onClick={() => navigate(-1)}>
          Voltar
        </button>
        <p className="eyebrow">
          ETAPA {engine.stepIndex + 1} DE {steps.length}
        </p>
        <h1>{step.label}</h1>
        <p className="muted">{step.cue}</p>
        <div className="track">
          <span style={{ width: `${Math.round(stepProgress(step, engine) * 100)}%` }} />
        </div>
      </section>
      <section className="performance">
        <p className="status">{paused ? 'TREINO PAUSADO' : 'ETAPA EM ANDAMENTO'}</p>
        <div>
          <p className="distance">{remainingLabel}</p>
          <p className="metric-label light">RESTANTE</p>
        </div>
        <div className="metrics light-metrics">
          <div>
            <strong>{formatPace(live.currentPace)}</strong>
            <p>RITMO ATUAL</p>
          </div>
          <div>
            <strong>{step.targetPaceSecondsPerKm ? formatPace(step.targetPaceSecondsPerKm) : '—'}</strong>
            <p>RITMO ALVO</p>
          </div>
          <div>
            <strong>{formatClock(live.movingSeconds)}</strong>
            <p>TEMPO</p>
          </div>
        </div>
        {step.target.type === 'distance' && (live.permission === 'denied' || live.permission === 'blocked') ? (
          <p className="warning">GPS INDISPONÍVEL · USE PULAR ETAPA PARA CONTINUAR</p>
        ) : null}
        <div className="run-actions">
          <button
            className="btn soft"
            type="button"
            onClick={() => {
              setEngine((current) => (paused ? resumeEngine(current) : pauseEngine(current)));
              if (paused) void live.resume();
              else void live.pause();
            }}
          >
            {paused ? 'Retomar' : 'Pausar'}
          </button>
          <button className="btn dark" type="button" onClick={() => setEngine((current) => skip(current, steps))}>
            Pular
          </button>
          <button className="btn danger" type="button" onClick={() => setEngine((current) => ({ ...current, status: 'finished' }))}>
            Fim
          </button>
        </div>
      </section>
    </main>
  );
}
