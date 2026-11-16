import type { RuntimeStep } from '@/types/domain';

export const START_COUNTDOWN = 10;

export type EngineStatus = 'countdown' | 'running' | 'paused' | 'finished';

export type StepResult = {
  stepId: string;
  status: 'done' | 'skipped';
  seconds: number;
  meters: number;
  onTarget: boolean | null;
};

export type EngineSnapshot = {
  status: EngineStatus;
  resumeTo: 'countdown' | 'running';
  countdown: number;
  stepIndex: number;
  stepMovingSeconds: number;
  stepDistanceMeters: number;
  results: StepResult[];
};

export function createEngine(): EngineSnapshot {
  return {
    status: 'countdown',
    resumeTo: 'running',
    countdown: START_COUNTDOWN,
    stepIndex: 0,
    stepMovingSeconds: 0,
    stepDistanceMeters: 0,
    results: [],
  };
}

export function tick(snapshot: EngineSnapshot, steps: RuntimeStep[], deltaSeconds: number, deltaMeters: number): EngineSnapshot {
  if (steps.length === 0) return snapshot;
  if (snapshot.status === 'countdown') {
    const countdown = Math.max(0, snapshot.countdown - Math.max(0, deltaSeconds));
    return countdown <= 0 ? { ...snapshot, status: 'running', countdown: 0 } : { ...snapshot, countdown };
  }
  if (snapshot.status !== 'running') return snapshot;
  const step = steps[snapshot.stepIndex];
  if (!step) return { ...snapshot, status: 'finished' };

  const next: EngineSnapshot = {
    ...snapshot,
    stepMovingSeconds: snapshot.stepMovingSeconds + Math.max(0, deltaSeconds),
    stepDistanceMeters: snapshot.stepDistanceMeters + Math.max(0, deltaMeters),
  };
  const completed =
    step.target.type === 'time' ? next.stepMovingSeconds >= step.target.seconds : next.stepDistanceMeters >= step.target.meters;
  if (!completed) return next;
  const seconds = step.target.type === 'time' ? step.target.seconds : next.stepMovingSeconds;
  return advance(next, steps, { ...next, stepMovingSeconds: seconds }, 'done');
}

export function completeStep(snapshot: EngineSnapshot, steps: RuntimeStep[]): EngineSnapshot {
  if (snapshot.status === 'finished') return snapshot;
  const running = snapshot.status === 'countdown' ? { ...snapshot, status: 'running' as const, countdown: 0 } : snapshot;
  return advance(running, steps, running, 'done');
}

export function skip(snapshot: EngineSnapshot, steps: RuntimeStep[]): EngineSnapshot {
  if (snapshot.status === 'finished') return snapshot;
  const running = snapshot.status === 'countdown' ? { ...snapshot, status: 'running' as const, countdown: 0 } : snapshot;
  return advance(running, steps, running, 'skipped');
}

export function finishEngine(snapshot: EngineSnapshot): EngineSnapshot {
  return { ...snapshot, status: 'finished' };
}

export function pauseEngine(snapshot: EngineSnapshot): EngineSnapshot {
  if (snapshot.status !== 'running' && snapshot.status !== 'countdown') return snapshot;
  return { ...snapshot, status: 'paused', resumeTo: snapshot.status };
}

export function resumeEngine(snapshot: EngineSnapshot): EngineSnapshot {
  if (snapshot.status !== 'paused') return snapshot;
  return { ...snapshot, status: snapshot.resumeTo };
}

export function stepRemaining(step: RuntimeStep | undefined, snapshot: EngineSnapshot): number {
  if (!step) return 0;
  if (step.target.type === 'time') return Math.max(0, step.target.seconds - snapshot.stepMovingSeconds);
  return Math.max(0, step.target.meters - snapshot.stepDistanceMeters);
}

export function stepProgress(step: RuntimeStep | undefined, snapshot: EngineSnapshot): number {
  if (!step) return 0;
  const total = step.target.type === 'time' ? step.target.seconds : step.target.meters;
  if (total <= 0) return 0;
  const done = step.target.type === 'time' ? snapshot.stepMovingSeconds : snapshot.stepDistanceMeters;
  return Math.min(1, Math.max(0, done / total));
}

export function judgeStep(step: RuntimeStep, seconds: number, meters: number): boolean | null {
  if (step.kind !== 'work') return null;
  if (step.target.type === 'time') return seconds >= step.target.seconds - 1;
  if (meters < step.target.meters * 0.97) return false;
  if (!step.goalSeconds) return true;
  return seconds <= step.goalSeconds + Math.max(2, step.goalSeconds * 0.02);
}

function advance(
  base: EngineSnapshot,
  steps: RuntimeStep[],
  measured: EngineSnapshot,
  status: StepResult['status'],
): EngineSnapshot {
  const step = steps[base.stepIndex];
  if (!step) return { ...base, status: 'finished' };
  const seconds = Math.round(measured.stepMovingSeconds);
  const meters = Math.round(measured.stepDistanceMeters);
  const result: StepResult = {
    stepId: step.id,
    status,
    seconds,
    meters,
    onTarget: status === 'done' ? judgeStep(step, seconds, meters) : null,
  };
  const results = [...base.results, result];
  if (base.stepIndex >= steps.length - 1) return { ...base, results, status: 'finished' };
  return { ...base, results, stepIndex: base.stepIndex + 1, stepMovingSeconds: 0, stepDistanceMeters: 0 };
}
