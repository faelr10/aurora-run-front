import type { Activity, RunnerProfile, TrackPoint } from '@/types/domain';
import { saveCompletedActivity } from '@/services/storage/database';
import { addDays, mondayOf, toDateKey } from '@/utils/format';
import { estimateCalories } from '@/utils/geo';

export function demoProfile(today = new Date()): RunnerProfile {
  return {
    currentDistanceMeters: 5000,
    fiveKmTimeSeconds: 29 * 60 + 42,
    weeklyFrequency: 4,
    goalDistanceMeters: 10000,
    goalTimeSeconds: 50 * 60,
    goalHorizonWeeks: 8,
    level: 'intermediate',
    planStartedAt: toDateKey(addDays(mondayOf(today), -7)),
  };
}

export async function ensureDemoActivities(email: string, today = new Date()): Promise<void> {
  const monday = mondayOf(today);
  const runs: { index: number; daysAgo: number; distance: number; pace: number; source: Activity['source']; title: string }[] = [
    { index: 1, daysAgo: 52, distance: 4200, pace: 430, source: 'free', title: 'Rodagem leve' },
    { index: 2, daysAgo: 45, distance: 5000, pace: 418, source: 'guided', title: 'Treino de qualidade' },
    { index: 3, daysAgo: 38, distance: 6400, pace: 405, source: 'free', title: 'Rodagem progressiva' },
    { index: 4, daysAgo: 31, distance: 8000, pace: 392, source: 'guided', title: 'Longão' },
    { index: 5, daysAgo: 24, distance: 10000, pace: 378, source: 'free', title: '10 km' },
    { index: 6, daysAgo: 16, distance: 21100, pace: 392, source: 'free', title: '21 km' },
    { index: 7, daysAgo: 8, distance: 6100, pace: 360, source: 'guided', title: 'Rodagem leve' },
    { index: 8, daysAgo: 1, distance: 5210, pace: 377, source: 'guided', title: 'Treino de qualidade' },
  ];

  for (const run of runs) {
    const started = new Date(monday);
    started.setDate(started.getDate() - run.daysAgo);
    started.setHours(7, 10, 0, 0);
    const movingSeconds = Math.round((run.distance / 1000) * run.pace);
    const startedAt = started.toISOString();
    const endedAt = new Date(started.getTime() + movingSeconds * 1000).toISOString();
    const activity: Activity = {
      clientId: `demo:${email}:${run.index}`,
      ownerEmail: email,
      sessionId: null,
      source: run.source,
      status: 'completed',
      title: run.title,
      startedAt,
      endedAt,
      movingSeconds,
      movingAnchorAt: null,
      distanceMeters: run.distance,
      averagePaceSecondsPerKm: run.pace,
      calories: estimateCalories(run.distance),
      demo: true,
      syncedAt: null,
      points: loopPoints(-23.5874, -46.6576, 24, 180 + run.index * 12, started.getTime()),
      splits: Array.from({ length: Math.floor(run.distance / 1000) }, (_, index) => ({
        kilometer: index + 1,
        durationSeconds: run.pace,
        paceSecondsPerKm: run.pace,
      })),
    };
    await saveCompletedActivity(activity);
  }
}

function loopPoints(latitude: number, longitude: number, count: number, radiusMeters: number, startedAt: number): TrackPoint[] {
  return Array.from({ length: count + 1 }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    return {
      latitude: latitude + (radiusMeters / 111_320) * Math.sin(angle),
      longitude: longitude + (radiusMeters / (111_320 * Math.cos((latitude * Math.PI) / 180))) * Math.cos(angle),
      accuracy: 8,
      timestamp: startedAt + index * 20_000,
      speed: 3,
    };
  });
}
