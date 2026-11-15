let audio: HTMLAudioElement | null = null;
let wanted = false;
let active = false;
let releaseTimer: number | null = null;
const listeners = new Set<(tracking: boolean) => void>();

function screenLockStopsGps(): boolean {
  if (typeof navigator === 'undefined') return true;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

export function supportsLockedTracking(): boolean {
  if (typeof navigator === 'undefined' || screenLockStopsGps()) return false;
  return /Android/i.test(navigator.userAgent) && typeof Audio !== 'undefined';
}

export function lockedTrackingActive(): boolean {
  return active;
}

export function onLockedTracking(listener: (tracking: boolean) => void): () => void {
  listeners.add(listener);
  listener(active);
  return () => listeners.delete(listener);
}

function emit(next: boolean): void {
  active = next;
  listeners.forEach((listener) => listener(next));
}

function quietWavUrl(): string {
  const sampleRate = 8000;
  const samples = sampleRate;
  const dataSize = samples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, dataSize, true);
  for (let index = 0; index < samples; index += 1) {
    const sample = Math.sin((2 * Math.PI * 180 * index) / sampleRate) * 80;
    view.setInt16(44 + index * 2, sample, true);
  }
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

function trackAudio(): HTMLAudioElement {
  if (audio) return audio;
  const element = new Audio(quietWavUrl());
  element.loop = true;
  element.preload = 'auto';
  element.volume = 0.02;
  element.setAttribute('playsinline', 'true');
  element.addEventListener('pause', () => {
    if (wanted) void element.play().catch(() => emit(false));
  });
  audio = element;
  return element;
}

function showRunningSession(): void {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: 'Corrida em andamento',
    artist: 'Aurora Run',
  });
  navigator.mediaSession.playbackState = 'playing';
  try {
    navigator.mediaSession.setActionHandler('pause', () => {
      if (!wanted) return;
      void audio?.play();
      navigator.mediaSession.playbackState = 'playing';
    });
  } catch {
    // The browser rejected the lock-screen control.
  }
}

function stopAudio(): void {
  wanted = false;
  audio?.pause();
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  emit(false);
}

export function retainLockedTracking(): void {
  if (releaseTimer != null) {
    window.clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  if (!supportsLockedTracking()) return;
  wanted = true;
  const element = trackAudio();
  void element
    .play()
    .then(() => {
      if (!wanted) return;
      showRunningSession();
      emit(true);
    })
    .catch(() => {
      if (wanted) emit(false);
    });
}

export function releaseLockedTracking(): void {
  if (releaseTimer != null) {
    window.clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  stopAudio();
}

export function scheduleReleaseLockedTracking(): void {
  if (releaseTimer != null) return;
  releaseTimer = window.setTimeout(() => {
    releaseTimer = null;
    stopAudio();
  }, 1200);
}

export function screenLockStopsTracking(): boolean {
  return screenLockStopsGps();
}

export function bindScreenAwake(): () => void {
  let lock: WakeLockSentinel | null = null;
  let stopped = false;

  async function request(): Promise<void> {
    if (stopped || document.visibilityState !== 'visible' || !navigator.wakeLock) return;
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      if (stopped) {
        await sentinel.release();
        return;
      }
      lock = sentinel;
      sentinel.addEventListener('release', () => {
        if (lock === sentinel) lock = null;
        if (!stopped && document.visibilityState === 'visible') void request();
      });
    } catch {
      lock = null;
    }
  }

  function onVisible(): void {
    if (document.visibilityState === 'visible') void request();
  }

  document.addEventListener('visibilitychange', onVisible);
  void request();
  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisible);
    void lock?.release();
    lock = null;
  };
}
