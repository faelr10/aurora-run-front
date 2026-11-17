export type Level = 'beginner' | 'intermediate' | 'advanced';

export type WorkoutType = 'easy' | 'intervals' | 'progressive' | 'long' | 'recovery' | 'rest';

export type StepKind = 'warmup' | 'work' | 'recovery' | 'cooldown' | 'steady';

export type StepTarget = { type: 'time'; seconds: number } | { type: 'distance'; meters: number };

export type PlanStep = {
  id: string;
  label: string;
  detail: string;
  kind: StepKind;
  target: StepTarget;
  repeats?: number;
  recoverySeconds?: number;
  targetPaceSecondsPerKm?: number;
  cue: string;
};

export type RuntimeStep = PlanStep & {
  repeatIndex?: number;
  repeatCount?: number;
  goalSeconds?: number;
  manner?: string;
};

export type PlanSession = {
  id: string;
  date: string;
  type: WorkoutType;
  title: string;
  objective: string;
  distanceMeters: number | null;
  durationSeconds: number | null;
  steps: PlanStep[];
};

export type PlanWorkoutKind = 'easy' | 'intervals' | 'long';

export type PlanWorkoutStep = {
  label: string;
  detail: string;
  minutes: number;
  repeats?: number;
  recoveryMinutes?: number;
  recoverySeconds?: number;
  recoveryDetail?: string;
  meters?: number;
  targetSeconds?: number;
};

export type PlanWorkout = {
  id: string;
  kind: PlanWorkoutKind;
  title: string;
  objective: string;
  distanceMeters: number | null;
  durationMinutes: number;
  steps: PlanWorkoutStep[];
  completedOn: string | null;
  activityId?: string | null;
};

export type PlanStage = {
  id: string;
  title: string;
  focus: string;
  workouts: PlanWorkout[];
};

export type DevelopmentPlan = {
  summary: string;
  stages: PlanStage[];
};

export type RunnerProfile = {
  age: number;
  weightKg: number;
  currentDistanceMeters: number;
  currentDurationSeconds: number;
  goalDistanceMeters: number;
  level: Level;
  planStartedAt: string;
  plan: DevelopmentPlan;
};

export type Preferences = {
  audioEnabled: boolean;
  vibrationEnabled: boolean;
  units: 'metric';
};

export type TrackPoint = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed: number | null;
};

export type Split = {
  kilometer: number;
  durationSeconds: number;
  paceSecondsPerKm: number;
};

export type ActivityStage = {
  id: string;
  label: string;
  kind: StepKind;
  status: 'done' | 'skipped' | 'partial';
  seconds: number;
  meters: number;
  targetSeconds: number | null;
  targetMeters: number | null;
  goalSeconds: number | null;
  onTarget: boolean | null;
};

export type ActivitySource = 'free' | 'guided';
export type ActivityStatus = 'recording' | 'paused' | 'completed';

export type Activity = {
  clientId: string;
  ownerEmail: string;
  sessionId: string | null;
  source: ActivitySource;
  status: ActivityStatus;
  title: string;
  startedAt: string;
  endedAt: string | null;
  movingSeconds: number;
  movingAnchorAt: string | null;
  distanceMeters: number;
  averagePaceSecondsPerKm: number;
  calories: number;
  demo: boolean;
  syncedAt: string | null;
  points: TrackPoint[];
  splits: Split[];
  stages?: ActivityStage[];
};

export const defaultPreferences: Preferences = {
  audioEnabled: true,
  vibrationEnabled: true,
  units: 'metric',
};
