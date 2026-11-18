import type { ActivityStage, RuntimeStep } from '@/types/domain';
import { formatEffort } from '@/features/training/plan';
import { formatMeters } from '@/utils/format';

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

export function recordedStages(steps: RuntimeStep[], snapshot: EngineSnapshot): ActivityStage[] {
  const saved = snapshot.results.flatMap((result) => {
    const step = steps.find((item) => item.id === result.stepId);
    return step ? [toStage(step, result.status, result.seconds, result.meters, result.onTarget)] : [];
  });
  const open = steps[snapshot.stepIndex];
  if (snapshot.results.length < steps.length && open && !saved.some((stage) => stage.id === open.id)) {
    saved.push(toStage(open, 'partial', Math.round(snapshot.stepMovingSeconds), Math.round(snapshot.stepDistanceMeters), null));
  }
  return saved;
}

export function effortNote(seconds: number, meters: number): string | null {
  if (seconds <= 0 && meters <= 0) return null;
  const time = formatEffort(seconds);
  return meters > 0 ? `${formatMeters(meters)} em ${time}` : time;
}

export function stageNote(stage: ActivityStage): string {
  if (stage.status === 'skipped') {
    const effort = effortNote(stage.seconds, stage.meters);
    return effort ? `pulado · ${effort}` : 'pulado';
  }
  const time = formatEffort(stage.seconds);
  if (stage.status === 'partial') return stage.seconds > 0 || stage.meters > 0 ? `${time} · interrompido` : 'interrompido';
  if (stage.kind === 'work' && stage.onTarget === true) return `${time} · no tempo`;
  if (stage.kind === 'work' && stage.onTarget === false && stage.goalSeconds != null) {
    const over = stage.seconds - stage.goalSeconds;
    if (over > 0) return `${time} · +${over} s`;
    if (stage.targetMeters) return `${formatMeters(stage.meters)} de ${formatMeters(stage.targetMeters)}`;
  }
  if (stage.kind === 'work' && stage.targetMeters) return `${formatMeters(stage.meters)} em ${time}`;
  return time;
}

function toStage(
  step: RuntimeStep,
  status: ActivityStage['status'],
  seconds: number,
  meters: number,
  onTarget: boolean | null,
): ActivityStage {
  return {
    id: step.id,
    label: stageLabel(step),
    kind: step.kind,
    status,
    seconds,
    meters,
    targetSeconds: step.target.type === 'time' ? step.target.seconds : null,
    targetMeters: step.target.type === 'distance' ? step.target.meters : null,
    goalSeconds: step.goalSeconds ?? null,
    onTarget,
  };
}

function stageLabel(step: RuntimeStep): string {
  if (step.kind === 'work' && step.repeatIndex && step.repeatCount) {
    return `${step.label.replace(/\s+\d+\s+de\s+\d+$/, '')} ${step.repeatIndex}/${step.repeatCount}`;
  }
  if (step.kind === 'recovery') return `Descanso · ${step.manner ?? 'caminhando'}`;
  return step.label;
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
  const nextIndex = base.stepIndex + 1;
  if (nextIndex >= steps.length) return { ...base, results, status: 'finished' };
  const nextStep = steps[nextIndex];
  const carried = carriedDistance(step, nextStep, meters);
  const started = { ...base, results, stepIndex: nextIndex, stepMovingSeconds: 0, stepDistanceMeters: carried };
  if (nextStep.target.type === 'distance' && carried >= nextStep.target.meters) return advance(started, steps, started, 'done');
  return started;
}

function carriedDistance(finished: RuntimeStep, next: RuntimeStep, meters: number): number {
  if (finished.kind !== 'warmup' || next.kind !== 'steady' || next.target.type !== 'distance') return 0;
  return Math.max(0, meters);
}
