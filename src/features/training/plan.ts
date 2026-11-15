import type { PlanSession, PlanStep, RunnerProfile, RuntimeStep, WorkoutType } from '@/types/domain';
import { addDays, formatMeters, mondayOf, parseDateKey, toDateKey } from '@/utils/format';

export const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;

const SCHEDULE: Record<number, { dow: number; type: Exclude<WorkoutType, 'rest'> }[]> = {
  2: [
    { dow: 2, type: 'intervals' },
    { dow: 6, type: 'long' },
  ],
  3: [
    { dow: 1, type: 'intervals' },
    { dow: 3, type: 'easy' },
    { dow: 6, type: 'long' },
  ],
  4: [
    { dow: 1, type: 'intervals' },
    { dow: 3, type: 'progressive' },
    { dow: 5, type: 'easy' },
    { dow: 6, type: 'long' },
  ],
  5: [
    { dow: 0, type: 'easy' },
    { dow: 1, type: 'intervals' },
    { dow: 3, type: 'progressive' },
    { dow: 5, type: 'recovery' },
    { dow: 6, type: 'long' },
  ],
  6: [
    { dow: 0, type: 'easy' },
    { dow: 1, type: 'intervals' },
    { dow: 2, type: 'recovery' },
    { dow: 3, type: 'progressive' },
    { dow: 5, type: 'easy' },
    { dow: 6, type: 'long' },
  ],
};

const COPY: Record<Exclude<WorkoutType, 'rest'>, { title: string; objective: string }> = {
  easy: {
    title: 'Rodagem leve',
    objective: 'Correr confortável, em um ritmo em que ainda dá para conversar.',
  },
  intervals: {
    title: 'Treino de qualidade',
    objective: 'Desenvolver velocidade e resistência com tiros curtos.',
  },
  progressive: {
    title: 'Rodagem progressiva',
    objective: 'Começar leve e terminar perto do ritmo que você quer sustentar.',
  },
  long: {
    title: 'Longão',
    objective: 'Aumentar a resistência com um ritmo constante.',
  },
  recovery: {
    title: 'Recuperação',
    objective: 'Soltar o corpo com um trote bem leve.',
  },
};

function lerp(from: number, to: number, progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return from + (to - from) * clamped;
}

function roundDistance(meters: number): number {
  return Math.max(1000, Math.round(meters / 100) * 100);
}

function paceSecondsPerKm(profile: RunnerProfile): number {
  if (profile.fiveKmTimeSeconds <= 0) return 450;
  return profile.fiveKmTimeSeconds / 5;
}

export function currentWeekIndex(profile: RunnerProfile, today = new Date()): number {
  const start = mondayOf(parseDateKey(profile.planStartedAt));
  const current = mondayOf(today);
  const diff = Math.round((current.getTime() - start.getTime()) / 86_400_000 / 7);
  return Math.max(0, Math.min(profile.goalHorizonWeeks - 1, diff));
}

export function planProgress(profile: RunnerProfile, today = new Date()): { week: number; total: number; ratio: number } {
  const week = currentWeekIndex(profile, today) + 1;
  const total = Math.max(1, profile.goalHorizonWeeks);
  return { week, total, ratio: week / total };
}

export function buildPlan(profile: RunnerProfile): PlanSession[] {
  const frequency = Math.min(6, Math.max(2, profile.weeklyFrequency));
  const pattern = SCHEDULE[frequency] ?? SCHEDULE[3];
  const start = mondayOf(parseDateKey(profile.planStartedAt));
  const sessions: PlanSession[] = [];

  for (let week = 0; week < profile.goalHorizonWeeks; week += 1) {
    const monday = addDays(start, week * 7);
    for (const slot of pattern) {
      const date = toDateKey(addDays(monday, slot.dow));
      sessions.push(makeSession(profile, week, date, slot.type));
    }
  }

  return sessions.sort((left, right) => left.date.localeCompare(right.date));
}

export function sessionsForWeek(profile: RunnerProfile, sessions: PlanSession[], today = new Date()): PlanSession[] {
  const monday = addDays(mondayOf(parseDateKey(profile.planStartedAt)), currentWeekIndex(profile, today) * 7);
  const from = toDateKey(monday);
  const to = toDateKey(addDays(monday, 7));
  return sessions.filter((session) => session.date >= from && session.date < to);
}

export function weekDates(today = new Date()): string[] {
  const monday = mondayOf(today);
  return Array.from({ length: 7 }, (_, index) => toDateKey(addDays(monday, index)));
}

export function nextSession(sessions: PlanSession[], today = new Date()): PlanSession | null {
  const key = toDateKey(today);
  return sessions.find((session) => session.date >= key) ?? null;
}

export function sessionOn(sessions: PlanSession[], date: string): PlanSession | null {
  return sessions.find((session) => session.date === date) ?? null;
}

export function timeline(session: PlanSession): { label: string; detail: string }[] {
  const items: { label: string; detail: string }[] = [];
  for (const step of session.steps) {
    items.push({ label: step.label, detail: step.detail });
    if ((step.repeats ?? 1) > 1 && step.recoverySeconds) {
      items.push({
        label: 'Recuperação',
        detail: `${Math.round(step.recoverySeconds / 60)} min · trote leve`,
      });
    }
  }
  return items;
}

export function expandSteps(steps: PlanStep[]): RuntimeStep[] {
  const runtime: RuntimeStep[] = [];
  for (const step of steps) {
    const count = step.repeats ?? 1;
    if (count > 1 && step.target.type === 'distance') {
      for (let index = 0; index < count; index += 1) {
        runtime.push({
          ...step,
          id: `${step.id}-${index + 1}`,
          label: `Tiro ${index + 1} de ${count}`,
          detail: formatMeters(step.target.meters),
          repeats: 1,
          repeatIndex: index,
          repeatCount: count,
        });
        if (index < count - 1 && step.recoverySeconds) {
          runtime.push({
            id: `${step.id}-recovery-${index + 1}`,
            label: 'Recuperação',
            detail: `${Math.round(step.recoverySeconds / 60)} min · trote leve`,
            kind: 'recovery',
            target: { type: 'time', seconds: step.recoverySeconds },
            cue: 'Solte o ritmo e respire.',
          });
        }
      }
    } else {
      runtime.push(step);
    }
  }
  return runtime;
}

function makeSession(
  profile: RunnerProfile,
  week: number,
  date: string,
  type: Exclude<WorkoutType, 'rest'>,
): PlanSession {
  const progress = profile.goalHorizonWeeks <= 1 ? 1 : week / (profile.goalHorizonWeeks - 1);
  const pace = paceSecondsPerKm(profile);
  const easy = roundDistance(
    lerp(profile.currentDistanceMeters * 0.75, Math.max(profile.currentDistanceMeters, profile.goalDistanceMeters * 0.55), progress),
  );
  const long = roundDistance(lerp(profile.currentDistanceMeters, profile.goalDistanceMeters, progress));
  const id = `${date}-${type}`;
  const copy = COPY[type];

  if (type === 'intervals') {
    const repeats = profile.level === 'beginner' ? 3 : profile.level === 'advanced' ? 6 : 4;
    const recoverySeconds = 120;
    const steps: PlanStep[] = [
      timeStep(`${id}-warmup`, 'Aquecimento', '10 min · ritmo leve', 'warmup', 600, 'Comece leve para aquecer.'),
      {
        id: `${id}-reps`,
        label: `${repeats} x 400 m`,
        detail: 'ritmo forte',
        kind: 'work',
        target: { type: 'distance', meters: 400 },
        repeats,
        recoverySeconds,
        targetPaceSecondsPerKm: Math.round(pace * 0.98),
        cue: 'Mantenha o ritmo.',
      },
      timeStep(`${id}-cooldown`, 'Desaquecimento', '10 min · ritmo leve', 'cooldown', 600, 'Diminua o ritmo e solte os ombros.'),
    ];
    return {
      id,
      date,
      type,
      title: copy.title,
      objective: copy.objective,
      distanceMeters: repeats * 400,
      durationSeconds: 600 + 600 + recoverySeconds * (repeats - 1),
      steps,
    };
  }

  if (type === 'progressive') {
    const distance = roundDistance(easy * 1.1);
    const part = roundDistance(distance / 3);
    const cues = [
      { label: 'Parte 1', detail: `${formatMeters(part)} · ritmo leve`, factor: 1.22, cue: 'Comece confortável.' },
      { label: 'Parte 2', detail: `${formatMeters(part)} · ritmo moderado`, factor: 1.08, cue: 'Aumente um pouco o ritmo.' },
      { label: 'Parte 3', detail: `${formatMeters(part)} · ritmo firme`, factor: 0.98, cue: 'Feche forte, sem sprint.' },
    ];
    return {
      id,
      date,
      type,
      title: copy.title,
      objective: copy.objective,
      distanceMeters: part * 3,
      durationSeconds: null,
      steps: cues.map((item, index) => ({
        id: `${id}-part-${index + 1}`,
        label: item.label,
        detail: item.detail,
        kind: 'steady',
        target: { type: 'distance', meters: part },
        targetPaceSecondsPerKm: Math.round(pace * item.factor),
        cue: item.cue,
      })),
    };
  }

  const distance = type === 'long' ? long : type === 'recovery' ? roundDistance(easy * 0.6) : easy;
  const factor = type === 'long' ? 1.15 : type === 'recovery' ? 1.35 : 1.22;
  return {
    id,
    date,
    type,
    title: copy.title,
    objective: copy.objective,
    distanceMeters: distance,
    durationSeconds: null,
    steps: [
      {
        id: `${id}-steady`,
        label: copy.title,
        detail: `${formatMeters(distance)} · ${type === 'recovery' ? 'trote leve' : 'ritmo constante'}`,
        kind: 'steady',
        target: { type: 'distance', meters: distance },
        targetPaceSecondsPerKm: Math.round(pace * factor),
        cue: type === 'recovery' ? 'Mantenha um trote bem leve.' : 'Ache um ritmo que você consiga sustentar.',
      },
    ],
  };
}

function timeStep(
  id: string,
  label: string,
  detail: string,
  kind: PlanStep['kind'],
  seconds: number,
  cue: string,
): PlanStep {
  return {
    id,
    label,
    detail,
    kind,
    target: { type: 'time', seconds },
    cue,
  };
}
