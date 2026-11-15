import { retainLockedTracking } from '@/services/run-presence';

export type LocationPermission = 'unknown' | 'granted' | 'denied' | 'blocked';

type FixListener = (position: GeolocationPosition) => void;
type PermissionListener = (permission: LocationPermission) => void;

const watchOptions: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 10_000,
  timeout: 60_000,
};

let permission: LocationPermission = 'unknown';
let watchId: number | null = null;
let latest: GeolocationPosition | null = null;
let stopTimer: number | null = null;
const fixes = new Set<FixListener>();
const permissionListeners = new Set<PermissionListener>();

export function locationBlock(): 'http' | 'in-app' | 'missing' | null {
  if (typeof navigator === 'undefined') return 'missing';
  if (/Instagram|FBAN|FBAV|FB_IAB|WhatsApp|Line\/|TikTok|Snapchat|LinkedInApp/i.test(navigator.userAgent)) {
    return 'in-app';
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'http';
  if (!navigator.geolocation) return 'missing';
  return null;
}

function emitPermission(next: LocationPermission): void {
  permission = next;
  permissionListeners.forEach((listener) => listener(next));
}

function emitFix(position: GeolocationPosition): void {
  latest = position;
  emitPermission('granted');
  fixes.forEach((listener) => listener(position));
}

function onWatchError(error: GeolocationPositionError): void {
  if (error.code === error.PERMISSION_DENIED) emitPermission('denied');
}

function stopWatch(): void {
  if (watchId == null || typeof navigator === 'undefined' || !navigator.geolocation) {
    watchId = null;
    return;
  }
  navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

function ensureWatch(): void {
  if (watchId != null || locationBlock() || !navigator.geolocation) return;
  watchId = navigator.geolocation.watchPosition(emitFix, onWatchError, watchOptions);
}

export function readLocationPermission(): LocationPermission {
  if (locationBlock()) return 'blocked';
  return permission;
}

export function onLocationPermission(listener: PermissionListener): () => void {
  permissionListeners.add(listener);
  listener(readLocationPermission());
  return () => permissionListeners.delete(listener);
}

export function primeLocation(): void {
  if (locationBlock()) {
    emitPermission('blocked');
    return;
  }
  if (permission === 'denied') {
    stopWatch();
    latest = null;
    emitPermission('unknown');
  }
  retainLockedTracking();
  ensureWatch();
}

export function subscribeFixes(listener: FixListener): () => void {
  if (stopTimer != null) {
    window.clearTimeout(stopTimer);
    stopTimer = null;
  }
  fixes.add(listener);
  if (latest) listener(latest);
  if (!locationBlock()) ensureWatch();
  return () => {
    fixes.delete(listener);
    if (fixes.size > 0 || stopTimer != null) return;
    stopTimer = window.setTimeout(() => {
      stopTimer = null;
      if (fixes.size === 0) stopWatch();
    }, 1200);
  };
}
