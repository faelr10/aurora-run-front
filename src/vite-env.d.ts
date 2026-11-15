/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface WakeLockSentinel extends EventTarget {
  release: () => Promise<void>;
}

interface Navigator {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> };
}
