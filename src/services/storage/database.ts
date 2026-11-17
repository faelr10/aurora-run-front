import type { Activity, ActivitySource, ActivityStage, Preferences, RunnerProfile, Split, TrackPoint } from '@/types/domain';
import { defaultPreferences } from '@/types/domain';
import { estimateCalories, reviewFix, type GeoPoint } from '@/utils/geo';

export type AccountRecord = {
  email: string;
  name: string;
  salt: string;
  passwordHash: string;
  profile: RunnerProfile | null;
  preferences: Preferences;
  profileBackup: RunnerProfile | null;
  nameBackup: string | null;
};

const DB_NAME = 'aurora';
const DB_VERSION = 1;

let databasePromise: Promise<IDBDatabase> | null = null;
let queue: Promise<unknown> = Promise.resolve();
let heldFix: { clientId: string; point: GeoPoint } | null = null;

function geoOf(point: TrackPoint | null): GeoPoint | null {
  if (!point) return null;
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    accuracy: point.accuracy,
    timestamp: point.timestamp,
    speed: point.speed,
  };
}

function absorbFix(
  activity: Activity,
  commit: GeoPoint,
  segmentMeters: number,
  movingSeconds: number,
): Activity {
  const trackPoint: TrackPoint = {
    latitude: commit.latitude,
    longitude: commit.longitude,
    accuracy: commit.accuracy ?? 0,
    timestamp: commit.timestamp,
    speed: commit.speed ?? null,
  };
  if (segmentMeters === 0 && activity.points.length > 0) {
    const points = [...activity.points];
    points[points.length - 1] = trackPoint;
    return { ...activity, points };
  }
  const points = [...activity.points, trackPoint];
  const distance = activity.distanceMeters + segmentMeters;
  const previousKm = Math.floor(activity.distanceMeters / 1000);
  const nextKm = Math.floor(distance / 1000);
  const splits: Split[] = [...activity.splits];
  if (nextKm > previousKm) {
    const covered = splits.reduce((sum, split) => sum + split.durationSeconds, 0);
    const count = nextKm - previousKm;
    const each = Math.max(1, Math.round((movingSeconds - covered) / count));
    for (let kilometer = previousKm + 1; kilometer <= nextKm; kilometer += 1) {
      const split = { kilometer, durationSeconds: each, paceSecondsPerKm: each };
      const index = splits.findIndex((item) => item.kilometer === kilometer);
      if (index >= 0) splits[index] = split;
      else splits.push(split);
    }
  }
  return {
    ...activity,
    points,
    splits,
    distanceMeters: distance,
    averagePaceSecondsPerKm: distance >= 10 ? Math.round(movingSeconds / (distance / 1000)) : 0,
    calories: estimateCalories(distance),
  };
}

function clearHeld(clientId: string): void {
  if (heldFix?.clientId === clientId) heldFix = null;
}

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function getDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('accounts')) {
          database.createObjectStore('accounts', { keyPath: 'email' });
        }
        if (!database.objectStoreNames.contains('activities')) {
          const store = database.createObjectStore('activities', { keyPath: 'clientId' });
          store.createIndex('ownerEmail', 'ownerEmail', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return databasePromise;
}

async function readAccount(email: string): Promise<AccountRecord | null> {
  const database = await getDatabase();
  const tx = database.transaction('accounts', 'readonly');
  const row = await requestToPromise(tx.objectStore('accounts').get(email.trim().toLowerCase()));
  return (row as AccountRecord | undefined) ?? null;
}

async function writeAccount(account: AccountRecord, mode: 'add' | 'put'): Promise<void> {
  const database = await getDatabase();
  const tx = database.transaction('accounts', 'readwrite');
  const store = tx.objectStore('accounts');
  await requestToPromise(mode === 'add' ? store.add(account) : store.put(account));
}

async function readActivities(ownerEmail?: string): Promise<Activity[]> {
  const database = await getDatabase();
  const tx = database.transaction('activities', 'readonly');
  const store = tx.objectStore('activities');
  const request = ownerEmail ? store.index('ownerEmail').getAll(ownerEmail) : store.getAll();
  const rows = await requestToPromise(request);
  return rows as Activity[];
}

async function writeActivity(activity: Activity): Promise<void> {
  const database = await getDatabase();
  const tx = database.transaction('activities', 'readwrite');
  await requestToPromise(tx.objectStore('activities').put(activity));
}

export function findAccount(email: string): Promise<AccountRecord | null> {
  return enqueue(() => readAccount(email));
}

export function insertAccount(account: AccountRecord): Promise<void> {
  return enqueue(() =>
    writeAccount(
      { ...account, email: account.email.trim().toLowerCase(), preferences: { ...defaultPreferences, ...account.preferences } },
      'add',
    ),
  );
}

export function updateAccount(account: AccountRecord): Promise<void> {
  return enqueue(() =>
    writeAccount(
      { ...account, email: account.email.trim().toLowerCase(), preferences: { ...defaultPreferences, ...account.preferences } },
      'put',
    ),
  );
}

export function getRecording(ownerEmail: string): Promise<Activity | null> {
  return enqueue(async () => {
    const rows = await readActivities(ownerEmail.trim().toLowerCase());
    return (
      rows
        .filter((activity) => activity.status === 'recording' || activity.status === 'paused')
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0] ?? null
    );
  });
}

export function insertRecording(input: {
  clientId: string;
  ownerEmail: string;
  sessionId: string | null;
  source: ActivitySource;
  title: string;
  startedAt: string;
}): Promise<string> {
  return enqueue(async () => {
    const ownerEmail = input.ownerEmail.trim().toLowerCase();
    const existing = (await readActivities(ownerEmail))
      .filter((activity) => activity.status === 'recording' || activity.status === 'paused')
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0];
    if (existing) return existing.clientId;
    const activity: Activity = {
      clientId: input.clientId,
      ownerEmail,
      sessionId: input.sessionId,
      source: input.source,
      status: 'recording',
      title: input.title,
      startedAt: input.startedAt,
      endedAt: null,
      movingSeconds: 0,
      movingAnchorAt: input.startedAt,
      distanceMeters: 0,
      averagePaceSecondsPerKm: 0,
      calories: 0,
      demo: false,
      syncedAt: null,
      points: [],
      splits: [],
    };
    await writeActivity(activity);
    return activity.clientId;
  });
}

export function pauseRecording(clientId: string, movingSeconds: number): Promise<void> {
  return enqueue(async () => {
    const activity = await readOne(clientId);
    if (!activity) return;
    clearHeld(clientId);
    await writeActivity({
      ...activity,
      status: 'paused',
      movingSeconds: Math.round(movingSeconds),
      movingAnchorAt: null,
    });
  });
}

export function resumeRecording(clientId: string, anchorAt: string): Promise<void> {
  return enqueue(async () => {
    const activity = await readOne(clientId);
    if (!activity) return;
    await writeActivity({ ...activity, status: 'recording', movingAnchorAt: anchorAt });
  });
}

export function finishRecording(clientId: string, movingSeconds: number, endedAt: string, stages?: ActivityStage[]): Promise<void> {
  return enqueue(async () => {
    const activity = await readOne(clientId);
    if (!activity) return;
    clearHeld(clientId);
    const moving = Math.round(movingSeconds);
    await writeActivity({
      ...activity,
      status: 'completed',
      endedAt,
      movingSeconds: moving,
      movingAnchorAt: null,
      averagePaceSecondsPerKm: activity.distanceMeters >= 10 ? Math.round(moving / (activity.distanceMeters / 1000)) : 0,
      calories: estimateCalories(activity.distanceMeters),
      ...(stages && stages.length > 0 ? { stages } : {}),
    });
  });
}

export function deleteActivity(clientId: string): Promise<void> {
  return enqueue(async () => {
    const database = await getDatabase();
    const tx = database.transaction('activities', 'readwrite');
    await requestToPromise(tx.objectStore('activities').delete(clientId));
  });
}

export function deleteDemoActivities(ownerEmail: string): Promise<void> {
  return enqueue(async () => {
    const rows = (await readActivities(ownerEmail.trim().toLowerCase())).filter((activity) => activity.demo);
    const database = await getDatabase();
    const tx = database.transaction('activities', 'readwrite');
    const store = tx.objectStore('activities');
    await Promise.all(rows.map((activity) => requestToPromise(store.delete(activity.clientId))));
  });
}

export function listActivities(ownerEmail: string): Promise<Activity[]> {
  return enqueue(async () => {
    const rows = await readActivities(ownerEmail.trim().toLowerCase());
    return rows
      .filter((activity) => activity.status === 'completed')
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  });
}

export function getActivity(clientId: string): Promise<Activity | null> {
  return enqueue(() => readOne(clientId));
}

export function listUnsynced(ownerEmail: string): Promise<Activity[]> {
  return enqueue(async () => {
    const rows = await readActivities(ownerEmail.trim().toLowerCase());
    return rows.filter((activity) => activity.status === 'completed' && activity.syncedAt == null && !activity.demo);
  });
}

export function markSynced(clientId: string, syncedAt: string): Promise<void> {
  return enqueue(async () => {
    const activity = await readOne(clientId);
    if (!activity) return;
    await writeActivity({ ...activity, syncedAt });
  });
}

export function saveCompletedActivity(activity: Activity): Promise<void> {
  return enqueue(() =>
    writeActivity({
      ...activity,
      ownerEmail: activity.ownerEmail.trim().toLowerCase(),
      status: 'completed',
      points: activity.points ?? [],
      splits: activity.splits ?? [],
    }),
  );
}

export function recordFixes(
  fixes: { latitude: number; longitude: number; accuracy: number | null; timestamp: number; speed: number | null }[],
): Promise<void> {
  if (fixes.length === 0) return Promise.resolve();
  return enqueue(async () => {
    const database = await getDatabase();
    const tx = database.transaction('activities', 'readonly');
    const rows = (await requestToPromise(tx.objectStore('activities').getAll())) as Activity[];
    const recording = rows
      .filter((activity) => activity.status === 'recording')
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0];
    if (!recording) return;

    const moving = liveMovingSeconds(recording);
    let draft = recording;
    if (heldFix && heldFix.clientId !== recording.clientId) heldFix = null;
    let pending = heldFix?.point ?? null;

    for (const fix of fixes) {
      const next: GeoPoint = {
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy: fix.accuracy,
        timestamp: fix.timestamp,
        speed: fix.speed,
      };
      const points = draft.points;
      const decision = reviewFix(geoOf(points.at(-1) ?? null), pending, next, geoOf(points.at(-2) ?? null));
      pending = decision.pending;
      if (!decision.commit) continue;
      draft = absorbFix(draft, decision.commit, decision.segmentMeters, moving);
    }

    heldFix = pending ? { clientId: recording.clientId, point: pending } : null;
    if (draft === recording) return;

    await writeActivity(draft);
  });
}

async function readOne(clientId: string): Promise<Activity | null> {
  const database = await getDatabase();
  const tx = database.transaction('activities', 'readonly');
  const row = await requestToPromise(tx.objectStore('activities').get(clientId));
  return (row as Activity | undefined) ?? null;
}

export function liveMovingSeconds(
  activity: Pick<Activity, 'status' | 'movingSeconds' | 'movingAnchorAt'>,
  now = Date.now(),
): number {
  if (activity.status === 'recording' && activity.movingAnchorAt) {
    return activity.movingSeconds + Math.max(0, (now - Date.parse(activity.movingAnchorAt)) / 1000);
  }
  return activity.movingSeconds;
}
