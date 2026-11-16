import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { announceKilometer } from '@/services/audio/cues';
import { syncActivities } from '@/services/api/sync';
import { syncFirebaseActivities } from '@/services/firebase/activities';
import { locationBlock, onLocationPermission, primeLocation, readLocationPermission, subscribeFixes, type LocationPermission } from '@/services/location';
import { releaseLockedTracking, scheduleReleaseLockedTracking } from '@/services/run-presence';
import {
  deleteActivity,
  finishRecording,
  getActivity,
  getRecording,
  insertRecording,
  liveMovingSeconds,
  listActivities,
  pauseRecording,
  recordFixes,
  resumeRecording,
} from '@/services/storage/database';
import { useSession } from '@/stores/session';
import type { Activity, ActivitySource } from '@/types/domain';
import { createId } from '@/utils/format';
import { currentPaceSecondsPerKm } from '@/utils/geo';

export function useActivities() {
  const email = useSession((state) => state.email);
  return useQuery({
    queryKey: ['activities', email],
    queryFn: () => listActivities(email ?? ''),
    enabled: Boolean(email),
  });
}

export function useActivity(clientId: string) {
  return useQuery({
    queryKey: ['activity', clientId],
    queryFn: () => getActivity(clientId),
    enabled: clientId.length > 0,
  });
}

export function useRecording() {
  const email = useSession((state) => state.email);
  return useQuery({
    queryKey: ['recording', email],
    queryFn: () => getRecording(email ?? ''),
    enabled: Boolean(email),
  });
}

type LiveState = {
  activity: Activity | null;
  permission: LocationPermission;
  now: number;
};

function rememberFix(position: GeolocationPosition): void {
  void recordFixes([
    {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
      speed: position.coords.speed,
    },
  ]);
}

export function useLiveActivity(input: {
  source: ActivitySource;
  title: string;
  sessionId?: string | null;
  enabled?: boolean;
  announceKilometers?: boolean;
}) {
  const email = useSession((state) => state.email);
  const preferences = useSession((state) => state.preferences);
  const mode = useSession((state) => state.mode);
  const enabled = input.enabled !== false;
  const announceRef = useRef(input.announceKilometers !== false);
  const queryClient = useQueryClient();
  const [state, setState] = useState<LiveState>({
    activity: null,
    permission: readLocationPermission(),
    now: 0,
  });
  const announcedKm = useRef(0);
  const preferencesRef = useRef(preferences);
  const clientIdRef = useRef<string | null>(null);
  const watchRef = useRef<(() => void) | null>(null);
  const closingRef = useRef(false);

  const startWatch = useCallback(() => {
    if (watchRef.current || locationBlock()) return;
    watchRef.current = subscribeFixes(rememberFix);
  }, []);

  const haltWatch = useCallback(() => {
    watchRef.current?.();
    watchRef.current = null;
  }, []);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    primeLocation();
    const stopPermission = onLocationPermission((permission) => {
      if (!cancelled) setState((current) => ({ ...current, permission }));
    });
    async function start() {
      if (!email) return;
      const clientId = await insertRecording({
        clientId: createId(),
        ownerEmail: email,
        sessionId: input.sessionId ?? null,
        source: input.source,
        title: input.title,
        startedAt: new Date().toISOString(),
      });
      clientIdRef.current = clientId;
      const activity = await getActivity(clientId);
      if (cancelled) return;
      announcedKm.current = activity?.splits.length ?? 0;
      setState((current) => ({ ...current, activity, now: Date.now() }));
      if (activity?.status === 'paused') {
        await resumeRecording(activity.clientId, new Date().toISOString());
        const resumed = await getActivity(activity.clientId);
        if (cancelled) return;
        setState((current) => ({ ...current, activity: resumed, now: Date.now() }));
        startWatch();
        return;
      }
      if (activity?.status === 'recording') startWatch();
    }
    void start();
    const timer = setInterval(() => {
      const clientId = clientIdRef.current;
      if (!clientId) {
        setState((current) => ({ ...current, now: Date.now() }));
        return;
      }
      void getActivity(clientId).then((full) => {
        if (!full || cancelled) return;
        if (full.splits.length > announcedKm.current) {
          announcedKm.current = full.splits.length;
          if (announceRef.current) announceKilometer(full.splits.length, preferencesRef.current.audioEnabled, preferencesRef.current.vibrationEnabled);
        }
        setState((current) => ({ ...current, activity: full, now: Date.now() }));
      });
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      haltWatch();
      stopPermission();
      scheduleReleaseLockedTracking();
      // #region agent log
      const clientId = clientIdRef.current;
      if (clientId) void getActivity(clientId).then((left) => {
        fetch('http://127.0.0.1:7653/ingest/52888a3f-ebb4-4635-b41b-c8ffc74477b2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c852c7'},body:JSON.stringify({sessionId:'c852c7',runId:'post-fix',hypothesisId:'A',location:'use-live-activity.ts:cleanup',message:'run screen unmounted',data:{clientId,closing:closingRef.current,status:left?.status??null,distance:left?.distanceMeters??null,anchor:left?.movingAnchorAt??null},timestamp:Date.now()})}).catch(()=>{});
      });
      // #endregion
    };
  }, [email, enabled, haltWatch, input.sessionId, input.source, input.title, startWatch]);

  const pause = useCallback(async () => {
    const activity = state.activity;
    if (!activity || activity.status !== 'recording') return;
    releaseLockedTracking();
    haltWatch();
    await pauseRecording(activity.clientId, liveMovingSeconds(activity));
    const next = await getActivity(activity.clientId);
    setState((current) => ({ ...current, activity: next }));
  }, [haltWatch, state.activity]);

  const resume = useCallback(async () => {
    const activity = state.activity;
    if (!activity || activity.status !== 'paused') return;
    primeLocation();
    await resumeRecording(activity.clientId, new Date().toISOString());
    startWatch();
    const next = await getActivity(activity.clientId);
    setState((current) => ({ ...current, activity: next }));
  }, [startWatch, state.activity]);

  const abandon = useCallback(async () => {
    closingRef.current = true;
    const activity = state.activity ?? (clientIdRef.current ? await getActivity(clientIdRef.current) : null);
    releaseLockedTracking();
    haltWatch();
    if (activity && activity.status !== 'completed') await deleteActivity(activity.clientId);
  }, [haltWatch, state.activity]);

  const finish = useCallback(async (): Promise<Activity | null> => {
    closingRef.current = true;
    const activity = state.activity ?? (clientIdRef.current ? await getActivity(clientIdRef.current) : null);
    if (!activity) return null;
    releaseLockedTracking();
    haltWatch();
    const moving = liveMovingSeconds(activity);
    await finishRecording(activity.clientId, moving, new Date().toISOString());
    const next = await getActivity(activity.clientId);
    await queryClient.invalidateQueries({ queryKey: ['activities'] });
    await queryClient.invalidateQueries({ queryKey: ['recording'] });
    if (email && mode === 'remote') void syncActivities(email).catch(() => undefined);
    if (email && mode === 'firebase') void syncFirebaseActivities(email).catch(() => undefined);
    return next;
  }, [email, haltWatch, mode, queryClient, state.activity]);

  const activity = state.activity;
  const movingSeconds = activity ? liveMovingSeconds(activity, state.now) : 0;
  const pace = activity && activity.distanceMeters >= 10 ? movingSeconds / (activity.distanceMeters / 1000) : null;

  return {
    activity,
    permission: state.permission,
    movingSeconds,
    currentPace: activity ? currentPaceSecondsPerKm(activity.points, state.now) : null,
    averagePace: pace,
    pause,
    resume,
    finish,
    abandon,
  };
}
