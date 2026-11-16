import type { PlanWorkout, PlanWorkoutKind, PlanWorkoutStep, RunnerProfile, RuntimeStep } from '@/types/domain';
import { formatMeters, formatPace } from '@/utils/format';

export const WORKOUT_LABEL: Record<PlanWorkoutKind, string> = {
  easy: 'Rodagem leve',
  intervals: 'Tiros',
  long: 'Longão',
};

export function findWorkout(profile: RunnerProfile, workoutId: string): PlanWorkout | null {
  for (const stage of profile.plan.stages) {
    const workout = stage.workouts.find((item) => item.id === workoutId);
    if (workout) return workout;
  }
  return null;
}

export function currentStageIndex(profile: RunnerProfile): number {
  const index = profile.plan.stages.findIndex((stage) => stage.workouts.some((workout) => !workout.completedOn));
  return index === -1 ? Math.max(0, profile.plan.stages.length - 1) : index;
}

export const WORKOUT_POINTS: Record<PlanWorkoutKind, number> = { easy: 50, intervals: 50, long: 80 };

export type TimelineKind = 'warmup' | 'work' | 'rest' | 'steady' | 'cooldown';

export type TimelineItem = {
  id: string;
  kind: TimelineKind;
  tag: string;
  headline: string;
  target: string | null;
  detail: string | null;
};

export function stepPrescription(step: PlanWorkoutStep): string {
  const times = step.repeats && step.repeats > 1 ? `${step.repeats} × ` : '';
  const seconds = step.targetSeconds ?? (step.meters ? step.minutes * 60 : null);
  if (step.meters && seconds) return `${times}${formatMeters(step.meters)} em ${formatEffort(seconds)}${paceSuffix(step.meters, seconds)}`;
  if (step.meters) return `${times}${formatMeters(step.meters)}`;
  return `${times}${step.minutes} min`;
}

export function recoveryPhrase(step: PlanWorkoutStep): string | null {
  const seconds = step.recoverySeconds ?? (step.recoveryMinutes ? step.recoveryMinutes * 60 : 0);
  if (!seconds) return null;
  const manner = step.recoveryDetail?.trim();
  const time = spokenDuration(seconds);
  if (!manner || manner.length > 42) return time;
  return `${time} ${manner}`;
}

export function intervalCount(workout: PlanWorkout): number {
  return workout.steps.reduce((total, step) => total + ((step.repeats ?? 1) > 1 ? (step.repeats ?? 1) : 0), 0);
}

export function workoutTimeline(workout: PlanWorkout): TimelineItem[] {
  const items: TimelineItem[] = [];
  workout.steps.forEach((step, index) => {
    const repeats = step.repeats ?? 1;
    const recoverySeconds = step.recoverySeconds ?? (step.recoveryMinutes ? step.recoveryMinutes * 60 : 0);
    const headline = step.meters ? formatMeters(step.meters) : `${step.minutes} min`;
    const target = stepTarget(step);
    if (repeats > 1) {
      for (let repeat = 0; repeat < repeats; repeat += 1) {
        items.push({
          id: `${workout.id}-${index}-${repeat + 1}`,
          kind: 'work',
          tag: `${step.label} ${repeat + 1}/${repeats}`,
          headline,
          target,
          detail: repeat === 0 ? step.detail : null,
        });
        if (repeat < repeats - 1 && recoverySeconds > 0) {
          items.push({
            id: `${workout.id}-${index}-rest-${repeat + 1}`,
            kind: 'rest',
            tag: 'Descanso',
            headline: shortDuration(recoverySeconds),
            target: step.recoveryDetail?.trim() && step.recoveryDetail.trim().length <= 42 ? step.recoveryDetail.trim() : 'caminhando',
            detail: repeat === 0 ? restCue(step) : null,
          });
        }
      }
      return;
    }
    items.push({
      id: `${workout.id}-${index}`,
      kind: stepKind(step.label),
      tag: step.label,
      headline,
      target,
      detail: step.detail,
    });
  });
  return items;
}

function stepKind(label: string): 'warmup' | 'cooldown' | 'steady' {
  const value = label.toLowerCase();
  if (value.includes('desaquec') || value.includes('volta à calma')) return 'cooldown';
  if (value.includes('aquec')) return 'warmup';
  return 'steady';
}

function stepTarget(step: PlanWorkoutStep): string | null {
  if (!step.meters) return null;
  const seconds = step.targetSeconds ?? step.minutes * 60;
  return `${formatEffort(seconds)}${paceSuffix(step.meters, seconds)}`;
}

function shortDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (minutes === 0) return `${seconds} s`;
  if (seconds === 0) return `${minutes} min`;
  return `${minutes} min ${seconds} s`;
}

export function formatEffort(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function spokenDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (minutes === 0) return `${seconds} segundos`;
  if (seconds === 0) return minutes === 1 ? '1 minuto' : `${minutes} minutos`;
  const minuteLabel = minutes === 1 ? '1 minuto' : `${minutes} minutos`;
  return `${minuteLabel} e ${seconds} segundos`;
}

function paceSuffix(meters: number, seconds: number): string {
  if (meters < 200) return '';
  return ` · ${formatPace(seconds / (meters / 1000))}/km`;
}

function restCue(step: PlanWorkoutStep): string {
  const manner = step.recoveryDetail?.trim().toLowerCase() ?? '';
  if (manner.includes('trote')) return 'Trote bem solto. O próximo tiro precisa sair no mesmo tempo.';
  if (manner.length > 42) return manner;
  return 'Caminhe o tempo inteiro. A respiração precisa baixar antes do próximo tiro.';
}

export function toRuntimeSteps(workout: PlanWorkout): RuntimeStep[] {
  const steps: RuntimeStep[] = [];
  workout.steps.forEach((step, index) => {
    const repeats = step.repeats ?? 1;
    const pace = step.meters && step.targetSeconds && step.meters >= 200 ? step.targetSeconds / (step.meters / 1000) : undefined;
    if (repeats > 1) {
      for (let repeat = 0; repeat < repeats; repeat += 1) {
        const effort = step.targetSeconds ? ` Alvo ${formatEffort(step.targetSeconds)}.` : '';
        steps.push({
          id: `${workout.id}-${index}-${repeat + 1}`,
          label: `${step.label} ${repeat + 1} de ${repeats}`,
          detail: step.detail,
          kind: 'work',
          target: step.meters ? { type: 'distance', meters: step.meters } : { type: 'time', seconds: (step.targetSeconds ?? step.minutes * 60) },
          cue: `${step.detail}${effort}`,
          repeatIndex: repeat + 1,
          repeatCount: repeats,
          ...(step.meters && step.targetSeconds ? { goalSeconds: step.targetSeconds } : {}),
          ...(pace ? { targetPaceSecondsPerKm: pace } : {}),
        });
        const recovery = step.recoverySeconds ?? (step.recoveryMinutes ? step.recoveryMinutes * 60 : 0);
        if (repeat < repeats - 1 && recovery > 0) {
          const phrase = recoveryPhrase(step) ?? spokenDuration(recovery);
          const manner = step.recoveryDetail?.trim();
          steps.push({
            id: `${workout.id}-${index}-recovery-${repeat + 1}`,
            label: 'Descanso',
            detail: `Descanso de ${phrase}.`,
            kind: 'recovery',
            target: { type: 'time', seconds: recovery },
            cue: restCue(step),
            manner: manner && manner.length <= 42 ? manner : 'caminhando',
          });
        }
      }
      return;
    }
    const kind = stepKind(step.label);
    steps.push({
      id: `${workout.id}-${index}`,
      label: step.label,
      detail: step.detail,
      kind,
      target: step.meters ? { type: 'distance', meters: step.meters } : { type: 'time', seconds: step.targetSeconds ?? step.minutes * 60 },
      cue: step.targetSeconds ? `${step.detail} Alvo ${formatEffort(step.targetSeconds)}.` : step.detail,
      ...(step.meters && step.targetSeconds ? { goalSeconds: step.targetSeconds } : {}),
      ...(pace ? { targetPaceSecondsPerKm: pace } : {}),
    });
  });
  return steps;
}
