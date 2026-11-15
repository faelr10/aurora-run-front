export type GeoPoint = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  timestamp: number;
  speed?: number | null;
};

const EARTH_RADIUS_METERS = 6_371_000;
const MAX_ACCURACY_METERS = 20;
const FIRST_FIX_ACCURACY_METERS = 15;
const MAX_SPEED_METERS_PER_SECOND = 9;
const MIN_SEGMENT_METERS = 4;
const STATIONARY_SPEED = 0.5;

export type FixReview = {
  commit: GeoPoint | null;
  pending: GeoPoint | null;
  segmentMeters: number;
};

export function distanceMeters(from: GeoPoint, to: GeoPoint): number {
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const haversine =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function isReliableFix(point: { accuracy?: number | null }): boolean {
  return point.accuracy != null && point.accuracy > 0 && point.accuracy <= MAX_ACCURACY_METERS;
}

function movementNeeded(accuracy: number): number {
  return Math.max(MIN_SEGMENT_METERS, accuracy * 0.55);
}

function bearing(from: GeoPoint, to: GeoPoint): number {
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return Math.atan2(y, x);
}

function turnDegrees(fromBearing: number, toBearing: number): number {
  const diff = Math.abs(fromBearing - toBearing) % (2 * Math.PI);
  return (Math.min(diff, 2 * Math.PI - diff) * 180) / Math.PI;
}

function passesMovement(anchor: GeoPoint, next: GeoPoint, before: GeoPoint | null): boolean {
  const meters = distanceMeters(anchor, next);
  const seconds = Math.max(0.2, (next.timestamp - anchor.timestamp) / 1000);
  if (meters / seconds > MAX_SPEED_METERS_PER_SECOND) return false;

  const accuracy = Math.max(anchor.accuracy ?? MAX_ACCURACY_METERS, next.accuracy ?? MAX_ACCURACY_METERS);
  if (meters < movementNeeded(accuracy)) return false;

  if (typeof next.speed === 'number' && next.speed > 0 && next.speed < STATIONARY_SPEED) return false;
  if (typeof next.speed === 'number' && next.speed >= STATIONARY_SPEED && meters / seconds > next.speed * 3 + 2) {
    return false;
  }

  if (before && isReliableFix(before)) {
    const prior = distanceMeters(before, anchor);
    if (prior >= MIN_SEGMENT_METERS && meters <= accuracy) {
      const turn = turnDegrees(bearing(before, anchor), bearing(anchor, next));
      if (turn >= 150) return false;
    }
  }

  return true;
}

function isSpike(anchor: GeoPoint, pending: GeoPoint, incoming: GeoPoint): boolean {
  const back = distanceMeters(anchor, incoming);
  const out = distanceMeters(anchor, pending);
  const hop = distanceMeters(pending, incoming);
  const accuracy = Math.max(anchor.accuracy ?? 0, pending.accuracy ?? 0, incoming.accuracy ?? 0);
  return (
    out >= MIN_SEGMENT_METERS &&
    back <= Math.max(accuracy, MIN_SEGMENT_METERS) &&
    back < out * 0.65 &&
    hop > out * 0.45
  );
}

function usable(point: GeoPoint): boolean {
  return isReliableFix(point) && Number.isFinite(point.latitude) && Number.isFinite(point.longitude);
}

export function reviewFix(
  anchor: GeoPoint | null,
  pending: GeoPoint | null,
  incoming: GeoPoint,
  before: GeoPoint | null = null,
): FixReview {
  if (!usable(incoming)) return { commit: null, pending, segmentMeters: 0 };
  if (anchor && incoming.timestamp < anchor.timestamp) return { commit: null, pending, segmentMeters: 0 };
  if (pending && incoming.timestamp < pending.timestamp) return { commit: null, pending, segmentMeters: 0 };

  if (!anchor || !usable(anchor)) {
    if ((incoming.accuracy ?? Number.POSITIVE_INFINITY) > FIRST_FIX_ACCURACY_METERS) {
      return { commit: null, pending: null, segmentMeters: 0 };
    }
    return { commit: incoming, pending: null, segmentMeters: 0 };
  }

  const seconds = Math.max(0.2, (incoming.timestamp - anchor.timestamp) / 1000);
  const meters = distanceMeters(anchor, incoming);
  if (!pending && seconds >= 20 && meters / seconds < 0.8) {
    return { commit: incoming, pending: null, segmentMeters: 0 };
  }

  if (!pending) {
    if (!passesMovement(anchor, incoming, before)) return { commit: null, pending: null, segmentMeters: 0 };
    return { commit: null, pending: incoming, segmentMeters: 0 };
  }

  if (isSpike(anchor, pending, incoming) || !passesMovement(anchor, pending, before)) {
    const nextPending = passesMovement(anchor, incoming, before) ? incoming : null;
    return { commit: null, pending: nextPending, segmentMeters: 0 };
  }

  const segmentMeters = distanceMeters(anchor, pending);
  const nextPending = passesMovement(pending, incoming, anchor) ? incoming : null;
  return { commit: pending, pending: nextPending, segmentMeters };
}

export function preferLiveFix<T extends GeoPoint>(current: T | null, next: T): T {
  if (!current || !Number.isFinite(current.latitude) || !Number.isFinite(current.longitude)) return next;
  if (!Number.isFinite(next.latitude) || !Number.isFinite(next.longitude)) return current;
  if (next.timestamp + 50 < current.timestamp) return current;

  const currentAccuracy = current.accuracy ?? Number.POSITIVE_INFINITY;
  const nextAccuracy = next.accuracy ?? Number.POSITIVE_INFINITY;
  if (currentAccuracy <= MAX_ACCURACY_METERS && nextAccuracy > MAX_ACCURACY_METERS + 15) return current;

  const meters = distanceMeters(current, next);
  const seconds = Math.max(0.2, (next.timestamp - current.timestamp) / 1000);
  if (meters / seconds > MAX_SPEED_METERS_PER_SECOND) return current;
  if (meters < movementNeeded(Math.max(currentAccuracy, nextAccuracy)) && nextAccuracy >= currentAccuracy - 3) {
    return current;
  }
  return next;
}

export function currentPaceSecondsPerKm(points: GeoPoint[], now = Date.now()): number | null {
  if (points.length < 2) return null;
  const recent = points.filter((point) => now - point.timestamp <= 20_000);
  const sample = recent.length >= 2 ? recent : points.slice(-2);
  let meters = 0;
  for (let index = 1; index < sample.length; index += 1) {
    meters += distanceMeters(sample[index - 1], sample[index]);
  }
  const seconds = (sample[sample.length - 1].timestamp - sample[0].timestamp) / 1000;
  if (meters < 8 || seconds < 3) return null;
  return (seconds / meters) * 1000;
}

export function estimateCalories(distanceMetersValue: number, weightKg = 70): number {
  return Math.round((distanceMetersValue / 1000) * weightKg * 1.036);
}
