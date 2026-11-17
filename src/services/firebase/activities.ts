import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';

import { queryClient } from '@/services/query-client';
import { firebaseAuth, firebaseConfigured, firebaseDb } from '@/services/firebase/app';
import { getActivity, listUnsynced, markSynced, saveCompletedActivity } from '@/services/storage/database';
import type { Activity, ActivityStage, TrackPoint } from '@/types/domain';

const CHUNK_SIZE = 300;

export async function syncFirebaseActivities(email: string): Promise<void> {
  if (!firebaseConfigured()) return;
  const user = firebaseAuth().currentUser;
  if (!user) return;
  const pending = await listUnsynced(email);
  for (const activity of pending) {
    await uploadActivity(user.uid, activity);
    await markSynced(activity.clientId, new Date().toISOString());
  }

  const saved = await downloadActivities(user.uid, email);
  if (pending.length > 0 || saved > 0) {
    await queryClient.invalidateQueries({ queryKey: ['activities'] });
    await queryClient.invalidateQueries({ queryKey: ['activity'] });
  }
}

async function uploadActivity(uid: string, activity: Activity): Promise<void> {
  const database = firebaseDb();
  const batch = writeBatch(database);
  const { points, ...meta } = activity;
  batch.set(doc(database, 'users', uid, 'activities', activity.clientId), {
    ...meta,
    pointCount: points.length,
  });
  chunk(points).forEach((part, index) => {
    const id = String(index).padStart(4, '0');
    batch.set(doc(database, 'users', uid, 'activities', activity.clientId, 'chunks', id), { points: part });
  });
  await batch.commit();
}

async function downloadActivities(uid: string, email: string): Promise<number> {
  const database = firebaseDb();
  const snapshot = await getDocs(collection(database, 'users', uid, 'activities'));
  let saved = 0;
  for (const item of snapshot.docs) {
    const data = item.data() as Activity & { pointCount?: number };
    const remoteStages = readStages(data.stages);
    const existing = await getActivity(item.id);
    if (existing) {
      const summary = summaryFromRemote(data);
      const withStages = remoteStages.length > 0 && (!existing.stages || existing.stages.length === 0);
      if (withStages || summaryChanged(existing, summary)) {
        await saveCompletedActivity({ ...existing, ...summary, ...(withStages ? { stages: remoteStages } : {}) });
        saved += 1;
      }
      continue;
    }
    const chunks = await getDocs(collection(database, 'users', uid, 'activities', item.id, 'chunks'));
    const points = chunks.docs
      .sort((left, right) => left.id.localeCompare(right.id))
      .flatMap((chunkDoc) => (chunkDoc.data().points as TrackPoint[] | undefined) ?? []);
    const { pointCount: _pointCount, ...activity } = data;
    void _pointCount;
    await saveCompletedActivity({
      ...activity,
      clientId: item.id,
      ownerEmail: email,
      demo: false,
      syncedAt: new Date().toISOString(),
      points,
      splits: activity.splits ?? [],
    });
    saved += 1;
  }
  return saved;
}

function summaryFromRemote(data: Activity): Pick<Activity, 'distanceMeters' | 'movingSeconds' | 'averagePaceSecondsPerKm' | 'calories' | 'splits'> {
  return {
    distanceMeters: data.distanceMeters,
    movingSeconds: data.movingSeconds,
    averagePaceSecondsPerKm: data.averagePaceSecondsPerKm,
    calories: data.calories,
    splits: data.splits ?? [],
  };
}

function summaryChanged(existing: Activity, summary: ReturnType<typeof summaryFromRemote>): boolean {
  return (
    existing.distanceMeters !== summary.distanceMeters ||
    existing.movingSeconds !== summary.movingSeconds ||
    existing.averagePaceSecondsPerKm !== summary.averagePaceSecondsPerKm ||
    existing.calories !== summary.calories ||
    JSON.stringify(existing.splits) !== JSON.stringify(summary.splits)
  );
}

function readStages(value: unknown): ActivityStage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const stage = item as ActivityStage;
    if (typeof stage.id !== 'string' || typeof stage.label !== 'string' || typeof stage.seconds !== 'number') return [];
    return [stage];
  });
}

function chunk(points: TrackPoint[]): TrackPoint[][] {
  if (points.length === 0) return [];
  const parts: TrackPoint[][] = [];
  for (let index = 0; index < points.length; index += CHUNK_SIZE) {
    parts.push(points.slice(index, index + CHUNK_SIZE));
  }
  return parts;
}
