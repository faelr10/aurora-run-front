import type { Activity, Split } from '@/types/domain';
import { addDays, mondayOf, parseDateKey, toDateKey } from '@/utils/format';

export type ActivityFilter = 'all' | 'free' | 'guided';

export function filterActivities(activities: Activity[], filter: ActivityFilter): Activity[] {
  if (filter === 'all') return activities;
  return activities.filter((activity) => activity.source === filter);
}

export function totals(activities: Activity[]): {
  distanceMeters: number;
  movingSeconds: number;
  count: number;
  averagePaceSecondsPerKm: number | null;
} {
  const distanceMeters = activities.reduce((sum, activity) => sum + activity.distanceMeters, 0);
  const movingSeconds = activities.reduce((sum, activity) => sum + activity.movingSeconds, 0);
  const averagePaceSecondsPerKm = distanceMeters >= 10 ? movingSeconds / (distanceMeters / 1000) : null;
  return { distanceMeters, movingSeconds, count: activities.length, averagePaceSecondsPerKm };
}

export function monthDistance(activities: Activity[], today = new Date()): number {
  const month = today.getMonth();
  const year = today.getFullYear();
  return activities
    .filter((activity) => {
      const date = new Date(activity.startedAt);
      return date.getMonth() === month && date.getFullYear() === year;
    })
    .reduce((sum, activity) => sum + activity.distanceMeters, 0);
}

export function weeklyPace(
  activities: Activity[],
  weeks = 8,
  today = new Date(),
): { label: string; pace: number | null }[] {
  const first = addDays(mondayOf(today), -(weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, index) => {
    const start = addDays(first, index * 7);
    const end = addDays(start, 7);
    const from = start.getTime();
    const to = end.getTime();
    const bucket = activities.filter((activity) => {
      const time = Date.parse(activity.startedAt);
      return time >= from && time < to;
    });
    const summary = totals(bucket);
    return {
      label: String(start.getDate()),
      pace: summary.averagePaceSecondsPerKm,
    };
  });
}

export type DistanceRecord = { label: string; meters: number; seconds: number | null };

export function distanceRecords(activities: Activity[]): DistanceRecord[] {
  const targets = [
    { label: '5 km', meters: 5000 },
    { label: '10 km', meters: 10000 },
    { label: '21 km', meters: 21000 },
  ];
  return targets.map((target) => ({
    ...target,
    seconds: bestTime(activities, target.meters),
  }));
}

export function previousActivity(activities: Activity[], currentId: string): Activity | null {
  const ordered = [...activities].sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  const index = ordered.findIndex((activity) => activity.clientId === currentId);
  if (index < 0) return null;
  return ordered[index + 1] ?? null;
}

function bestTime(activities: Activity[], meters: number): number | null {
  let best: number | null = null;
  for (const activity of activities) {
    const time = timeForDistance(activity.splits, activity.movingSeconds, activity.distanceMeters, meters);
    if (time == null) continue;
    if (best == null || time < best) best = time;
  }
  return best;
}

function timeForDistance(splits: Split[], movingSeconds: number, distanceMeters: number, target: number): number | null {
  const kilometers = Math.round(target / 1000);
  if (splits.length >= kilometers) {
    return splits.slice(0, kilometers).reduce((sum, split) => sum + split.durationSeconds, 0);
  }
  if (distanceMeters >= target * 0.98 && distanceMeters <= target * 1.08 && movingSeconds > 0) {
    return Math.round(movingSeconds * (target / distanceMeters));
  }
  return null;
}

export function weekLabel(dateKey: string): string {
  return toDateKey(parseDateKey(dateKey));
}
