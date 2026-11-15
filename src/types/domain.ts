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

export type RunnerProfile = {
  currentDistanceMeters: number;
  fiveKmTimeSeconds: number;
  weeklyFrequency: number;
  goalDistanceMeters: number;
  goalTimeSeconds: number;
  goalHorizonWeeks: number;
  level: Level;
  planStartedAt: string;
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
};

export const defaultPreferences: Preferences = {
  audioEnabled: true,
  vibrationEnabled: true,
  units: 'metric',
};
