import { create } from 'zustand';

import { demoProfile, ensureDemoActivities } from '@/features/history/demo';
import type { OnboardingValues } from '@/features/onboarding/schema';
import {
  apiEnabled,
  apiErrorMessage,
  bindTokenPersistence,
  fetchMe,
  loginAccount,
  registerAccount,
  savePreferences,
  saveProfile,
  setAuthTokens,
} from '@/services/api/client';
import { syncActivities } from '@/services/api/sync';
import { syncFirebaseActivities } from '@/services/firebase/activities';
import {
  loginFirebaseUser,
  readCloudUser,
  registerFirebaseUser,
  saveCloudPreferences,
  saveCloudProfile,
  signOutFirebase,
  waitForFirebaseUser,
} from '@/services/firebase/account';
import { firebaseConfigured } from '@/services/firebase/app';
import { requestDevelopmentPlan } from '@/services/openai/plan';
import { deleteDemoActivities, findAccount, getDatabase, insertAccount, updateAccount } from '@/services/storage/database';
import { defaultPreferences, type Preferences, type RunnerProfile } from '@/types/domain';
import { toDateKey } from '@/utils/format';

const SESSION_KEY = 'aurora.session';
const GUEST_PREFS_KEY = 'aurora.guest-preferences';
export const GUEST_OWNER = 'guest@local';

type PersistedSession = {
  mode: 'local' | 'remote';
  email: string;
  accessToken: string | null;
  refreshToken: string | null;
};

type SessionState = {
  ready: boolean;
  mode: 'local' | 'remote' | 'firebase' | null;
  email: string | null;
  name: string | null;
  profile: RunnerProfile | null;
  preferences: Preferences;
  demo: boolean;
  hydrate: () => Promise<void>;
  register: (input: { name: string; email: string; password: string }) => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  completeOnboarding: (values: OnboardingValues) => Promise<void>;
  completeWorkout: (workoutId: string, activityId?: string | null) => Promise<void>;
  updatePreferences: (preferences: Preferences) => Promise<void>;
  loadDemo: () => Promise<void>;
  clearDemo: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
};

let hydrating = false;

export const useSession = create<SessionState>((set, get) => ({
  ready: false,
  mode: null,
  email: null,
  name: null,
  profile: null,
  preferences: defaultPreferences,
  demo: false,

  hydrate: async () => {
    if (hydrating || get().ready) return;
    hydrating = true;
    try {
      await getDatabase();
      bindTokenPersistence((accessToken, refreshToken) => {
        const current = get();
        if (!current.email || current.mode !== 'remote') return;
        persistSession({ mode: 'remote', email: current.email, accessToken, refreshToken });
      });
      if (firebaseConfigured()) {
        const user = await waitForFirebaseUser();
        if (user) {
          const cloud = await readCloudUser(user);
          set({
            ready: true,
            mode: 'firebase',
            email: cloud.email,
            name: cloud.name,
            profile: cloud.profile,
            preferences: cloud.preferences,
            demo: false,
          });
          void syncFirebaseActivities(cloud.email).catch(() => undefined);
          return;
        }
      }
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) {
        set({ ready: true, ...guestState() });
        return;
      }
      const session = JSON.parse(raw) as PersistedSession;
      if (session.mode === 'remote' && session.accessToken) {
        setAuthTokens(session.accessToken, session.refreshToken);
        const me = await fetchMe();
        set({
          ready: true,
          mode: 'remote',
          email: me.user.email,
          name: me.user.name,
          profile: me.profile,
          preferences: { ...defaultPreferences, ...me.preferences },
          demo: false,
        });
        void syncActivities(me.user.email).catch(() => undefined);
        return;
      }
      const account = await findAccount(session.email);
      if (!account) {
        set({ ready: true, ...guestState() });
        return;
      }
      set({
        ready: true,
        mode: 'local',
        email: account.email,
        name: account.name,
        profile: account.profile,
        preferences: account.preferences,
        demo: Boolean(account.profileBackup),
      });
    } catch {
      setAuthTokens(null, null);
      set({ ready: true, ...guestState() });
    } finally {
      hydrating = false;
    }
  },

  register: async (input) => {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    if (firebaseConfigured()) {
      const cloud = await registerFirebaseUser({ ...input, email, name });
      set({ mode: 'firebase', email: cloud.email, name: cloud.name, profile: null, preferences: cloud.preferences, demo: false });
      void syncFirebaseActivities(cloud.email).catch(() => undefined);
      return;
    }
    if (apiEnabled()) {
      try {
        const auth = await registerAccount({ ...input, email });
        await adoptRemote(auth.accessToken, auth.refreshToken, set);
      } catch (error) {
        throw new Error(apiErrorMessage(error, 'Não foi possível criar a conta.'));
      }
      return;
    }
    const existing = await findAccount(email);
    if (existing) throw new Error('Este e-mail já está em uso.');
    const salt = createSalt();
    await insertAccount({
      email,
      name,
      salt,
      passwordHash: await hashPassword(input.password, salt),
      profile: null,
      preferences: defaultPreferences,
      profileBackup: null,
      nameBackup: null,
    });
    persistSession({ mode: 'local', email, accessToken: null, refreshToken: null });
    set({ mode: 'local', email, name, profile: null, preferences: defaultPreferences, demo: false });
  },

  login: async (input) => {
    const email = input.email.trim().toLowerCase();
    if (firebaseConfigured()) {
      const cloud = await loginFirebaseUser({ email, password: input.password });
      set({
        mode: 'firebase',
        email: cloud.email,
        name: cloud.name,
        profile: cloud.profile,
        preferences: cloud.preferences,
        demo: false,
      });
      void syncFirebaseActivities(cloud.email).catch(() => undefined);
      return;
    }
    if (apiEnabled()) {
      try {
        const auth = await loginAccount({ email, password: input.password });
        await adoptRemote(auth.accessToken, auth.refreshToken, set);
      } catch (error) {
        throw new Error(apiErrorMessage(error, 'Não foi possível entrar.'));
      }
      return;
    }
    const account = await findAccount(email);
    if (!account || account.passwordHash !== (await hashPassword(input.password, account.salt))) {
      throw new Error('E-mail ou senha inválidos.');
    }
    persistSession({ mode: 'local', email, accessToken: null, refreshToken: null });
    set({
      mode: 'local',
      email,
      name: account.name,
      profile: account.profile,
      preferences: account.preferences,
      demo: Boolean(account.profileBackup),
    });
  },

  completeOnboarding: async (values) => {
    const current = get();
    if (!current.email) throw new Error('Crie uma conta para guardar o plano.');
    const plan = await requestDevelopmentPlan(values);
    const profile: RunnerProfile = { ...values, plan, planStartedAt: toDateKey(new Date()) };
    await persistProfile(profile, set, get);
  },

  completeWorkout: async (workoutId, activityId) => {
    const current = get();
    const profile = current.profile;
    if (!profile) return;
    const today = toDateKey(new Date());
    let changed = false;
    const next: RunnerProfile = {
      ...profile,
      plan: {
        ...profile.plan,
        stages: profile.plan.stages.map((stage) => ({
          ...stage,
          workouts: stage.workouts.map((workout) => {
            if (workout.id !== workoutId) return workout;
            if (activityId) {
              if (workout.completedOn === today && workout.activityId === activityId) return workout;
              changed = true;
              return { ...workout, completedOn: today, activityId };
            }
            if (workout.completedOn) return workout;
            changed = true;
            return { ...workout, completedOn: today };
          }),
        })),
      },
    };
    if (!changed) return;
    if (current.demo) {
      set({ profile: next });
      return;
    }
    await persistProfile(next, set, get);
  },

  updatePreferences: async (preferences) => {
    const current = get();
    set({ preferences });
    if (current.mode === 'firebase') {
      const user = await waitForFirebaseUser();
      if (!user) return;
      await saveCloudPreferences(user.uid, preferences);
      return;
    }
    if (current.mode === 'remote') {
      const saved = await savePreferences(preferences);
      set({ preferences: saved });
      return;
    }
    if (current.mode !== 'local') {
      localStorage.setItem(GUEST_PREFS_KEY, JSON.stringify(preferences));
      return;
    }
    if (!current.email) return;
    const account = await findAccount(current.email);
    if (!account) return;
    await updateAccount({ ...account, preferences });
  },

  loadDemo: async () => {
    const current = get();
    if (!current.email) return;
    const profile = demoProfile();
    if (current.mode === 'local') {
      const account = await findAccount(current.email);
      if (!account) return;
      await updateAccount({
        ...account,
        name: 'Rafael',
        profile,
        profileBackup: account.profileBackup ?? account.profile,
        nameBackup: account.nameBackup ?? account.name,
      });
    }
    await ensureDemoActivities(current.email);
    set({ name: 'Rafael', profile, demo: true });
  },

  clearDemo: async () => {
    const current = get();
    if (!current.email) {
      set({ demo: false });
      return;
    }
    await deleteDemoActivities(current.email);
    if (current.mode !== 'local') {
      set({ demo: false });
      return;
    }
    const account = await findAccount(current.email);
    if (!account) return;
    await updateAccount({
      ...account,
      name: account.nameBackup ?? account.name,
      profile: account.profileBackup,
      profileBackup: null,
      nameBackup: null,
    });
    set({
      name: account.nameBackup ?? account.name,
      profile: account.profileBackup,
      demo: false,
    });
  },

  resetOnboarding: async () => {
    const current = get();
    if (current.email && (current.mode === 'local' || current.mode === 'firebase')) {
      if (current.mode === 'firebase') {
        const user = await waitForFirebaseUser();
        if (user) await saveCloudProfile(user.uid, null);
      } else {
        const account = await findAccount(current.email);
        if (account) await updateAccount({ ...account, profile: null });
      }
    }
    set({ profile: null, demo: false });
  },

  reload: async () => {
    const current = get();
    if (!current.email) return;
    if (current.mode === 'firebase') {
      const user = await waitForFirebaseUser();
      if (!user) throw new Error('Entre de novo para atualizar.');
      const cloud = await readCloudUser(user);
      set({
        email: cloud.email,
        name: cloud.name,
        profile: cloud.profile,
        preferences: cloud.preferences,
        demo: false,
      });
      await syncFirebaseActivities(cloud.email);
      return;
    }
    if (current.mode === 'remote') {
      const me = await fetchMe();
      set({
        email: me.user.email,
        name: me.user.name,
        profile: me.profile,
        preferences: { ...defaultPreferences, ...me.preferences },
        demo: false,
      });
      await syncActivities(me.user.email);
      return;
    }
    const account = await findAccount(current.email);
    if (!account) return;
    set({
      name: account.name,
      profile: account.profile,
      preferences: account.preferences,
      demo: Boolean(account.profileBackup),
    });
  },

  signOut: async () => {
    await signOutFirebase();
    setAuthTokens(null, null);
    localStorage.removeItem(SESSION_KEY);
    set({ ready: true, ...guestState() });
  },
}));

async function persistProfile(
  profile: RunnerProfile,
  set: (partial: Partial<SessionState>) => void,
  get: () => SessionState,
): Promise<void> {
  const current = get();
  if (!current.email) throw new Error('Crie uma conta para guardar o plano.');
  if (current.mode === 'firebase') {
    const user = await waitForFirebaseUser();
    if (!user) throw new Error('Entre de novo para guardar o plano.');
    await saveCloudProfile(user.uid, profile, current.name ?? undefined);
    set({ profile, demo: false });
    return;
  }
  if (current.mode === 'remote') {
    const me = await saveProfile(profile, current.name ?? undefined);
    set({ profile: me.profile ?? profile, name: me.user.name, demo: false });
    return;
  }
  const account = await findAccount(current.email);
  if (!account) throw new Error('Conta local não encontrada.');
  await updateAccount({ ...account, profile, profileBackup: null, nameBackup: null });
  set({ profile, demo: false });
}

async function adoptRemote(
  accessToken: string,
  refreshToken: string,
  set: (partial: Partial<SessionState>) => void,
): Promise<void> {
  setAuthTokens(accessToken, refreshToken);
  const me = await fetchMe();
  persistSession({ mode: 'remote', email: me.user.email, accessToken, refreshToken });
  set({
    mode: 'remote',
    email: me.user.email,
    name: me.user.name,
    profile: me.profile,
    preferences: { ...defaultPreferences, ...me.preferences },
    demo: false,
  });
  void syncActivities(me.user.email).catch(() => undefined);
}

function guestState(): Pick<SessionState, 'mode' | 'email' | 'name' | 'profile' | 'preferences' | 'demo'> {
  return {
    mode: null,
    email: GUEST_OWNER,
    name: null,
    profile: null,
    preferences: readGuestPreferences(),
    demo: false,
  };
}

function readGuestPreferences(): Preferences {
  const raw = localStorage.getItem(GUEST_PREFS_KEY);
  if (!raw) return defaultPreferences;
  try {
    return { ...defaultPreferences, ...(JSON.parse(raw) as Preferences) };
  } catch {
    return defaultPreferences;
  }
}

function persistSession(session: PersistedSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function createSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
