import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { announceKilometer } from '@/services/audio/cues';
import { syncActivities } from '@/services/api/sync';
import {
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
  permission: 'unknown' | 'granted' | 'denied';
  now: number;
};

let watchId: number | null = null;

function startWatch(): void {
  if (watchId != null || !navigator.geolocation) return;
  watchId = navigator.geolocation.watchPosition(
    (position) => {
      void recordFixes([
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          speed: position.coords.speed,
        },
      ]);
    },
    () => undefined,
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
  );
}

function stopWatch(): void {
  if (watchId == null || !navigator.geolocation) return;
  navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

function requestLocation(): Promise<'granted' | 'denied'> {
  if (!navigator.geolocation) return Promise.resolve('denied');
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve('granted'),
      () => resolve('denied'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 },
    );
  });
}

export function useLiveActivity(input: { source: ActivitySource; title: string; sessionId?: string | null }) {
  const email = useSession((state) => state.email);
  const preferences = useSession((state) => state.preferences);
  const mode = useSession((state) => state.mode);
  const queryClient = useQueryClient();
  const [state, setState] = useState<LiveState>({
    activity: null,
    permission: 'unknown',
    now: 0,
  });
  const announcedKm = useRef(0);
  const preferencesRef = useRef(preferences);
  const clientIdRef = useRef<string | null>(null);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    let cancelled = false;
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
      setState({ activity, permission: 'unknown', now: Date.now() });
      const permission = await requestLocation();
      if (cancelled) return;
      if (permission === 'granted' && activity?.status === 'recording') startWatch();
      setState((current) => ({ ...current, permission }));
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
          announceKilometer(full.splits.length, preferencesRef.current.audioEnabled, preferencesRef.current.vibrationEnabled);
        }
        setState((current) => ({ ...current, activity: full, now: Date.now() }));
      });
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      stopWatch();
    };
  }, [email, input.sessionId, input.source, input.title]);

  const pause = useCallback(async () => {
    const activity = state.activity;
    if (!activity || activity.status !== 'recording') return;
    stopWatch();
    await pauseRecording(activity.clientId, liveMovingSeconds(activity));
    const next = await getActivity(activity.clientId);
    setState((current) => ({ ...current, activity: next }));
  }, [state.activity]);

  const resume = useCallback(async () => {
    const activity = state.activity;
    if (!activity || activity.status !== 'paused') return;
    await resumeRecording(activity.clientId, new Date().toISOString());
    if (state.permission === 'granted') startWatch();
    const next = await getActivity(activity.clientId);
    setState((current) => ({ ...current, activity: next }));
  }, [state.activity, state.permission]);

  const finish = useCallback(async (): Promise<Activity | null> => {
    const activity = state.activity ?? (clientIdRef.current ? await getActivity(clientIdRef.current) : null);
    if (!activity) return null;
    stopWatch();
    const moving = liveMovingSeconds(activity);
    await finishRecording(activity.clientId, moving, new Date().toISOString());
    const next = await getActivity(activity.clientId);
    await queryClient.invalidateQueries({ queryKey: ['activities'] });
    await queryClient.invalidateQueries({ queryKey: ['recording'] });
    if (email && mode === 'remote') void syncActivities(email).catch(() => undefined);
    return next;
  }, [email, mode, queryClient, state.activity]);

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
  };
}
