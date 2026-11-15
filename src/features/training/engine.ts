import type { RuntimeStep } from '@/types/domain';

export type EngineStatus = 'running' | 'paused' | 'finished';

export type EngineSnapshot = {
  status: EngineStatus;
  stepIndex: number;
  stepMovingSeconds: number;
  stepDistanceMeters: number;
};

export function createEngine(): EngineSnapshot {
  return { status: 'running', stepIndex: 0, stepMovingSeconds: 0, stepDistanceMeters: 0 };
}

export function tick(
  snapshot: EngineSnapshot,
  steps: RuntimeStep[],
  deltaSeconds: number,
  deltaMeters: number,
): EngineSnapshot {
  if (snapshot.status !== 'running' || steps.length === 0) return snapshot;
  const step = steps[snapshot.stepIndex];
  if (!step) return { ...snapshot, status: 'finished' };

  const next: EngineSnapshot = {
    ...snapshot,
    stepMovingSeconds: snapshot.stepMovingSeconds + Math.max(0, deltaSeconds),
    stepDistanceMeters: snapshot.stepDistanceMeters + Math.max(0, deltaMeters),
  };
  const completed =
    step.target.type === 'time'
      ? next.stepMovingSeconds >= step.target.seconds
      : next.stepDistanceMeters >= step.target.meters;
  if (!completed) return next;
  if (snapshot.stepIndex >= steps.length - 1) return { ...next, status: 'finished' };
  return { ...next, stepIndex: snapshot.stepIndex + 1, stepMovingSeconds: 0, stepDistanceMeters: 0 };
}

export function skip(snapshot: EngineSnapshot, steps: RuntimeStep[]): EngineSnapshot {
  if (snapshot.stepIndex >= steps.length - 1) return { ...snapshot, status: 'finished' };
  return {
    ...snapshot,
    status: snapshot.status === 'finished' ? 'finished' : 'running',
    stepIndex: snapshot.stepIndex + 1,
    stepMovingSeconds: 0,
    stepDistanceMeters: 0,
  };
}

export function pauseEngine(snapshot: EngineSnapshot): EngineSnapshot {
  if (snapshot.status !== 'running') return snapshot;
  return { ...snapshot, status: 'paused' };
}

export function resumeEngine(snapshot: EngineSnapshot): EngineSnapshot {
  if (snapshot.status !== 'paused') return snapshot;
  return { ...snapshot, status: 'running' };
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
