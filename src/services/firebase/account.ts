import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { firebaseAuth, firebaseConfigured, firebaseDb } from '@/services/firebase/app';
import { defaultPreferences, type Preferences, type RunnerProfile } from '@/types/domain';

export type CloudUser = {
  uid: string;
  email: string;
  name: string;
  profile: RunnerProfile | null;
  preferences: Preferences;
};

type UserRecord = {
  email: string;
  name: string;
  profile: RunnerProfile | null;
  preferences: Preferences;
};

export function watchFirebaseUser(listener: (user: User | null) => void): () => void {
  if (!firebaseConfigured()) {
    listener(null);
    return () => undefined;
  }
  return onAuthStateChanged(firebaseAuth(), listener);
}

export function waitForFirebaseUser(): Promise<User | null> {
  if (!firebaseConfigured()) return Promise.resolve(null);
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(firebaseAuth(), (user) => {
      stop();
      resolve(user);
    });
  });
}

export async function registerFirebaseUser(input: { name: string; email: string; password: string }): Promise<CloudUser> {
  const name = input.name.trim();
  let user: User;
  try {
    user = (await createUserWithEmailAndPassword(firebaseAuth(), input.email, input.password)).user;
  } catch (error) {
    if (!hasCode(error, 'auth/email-already-in-use')) {
      throw new Error(firebaseAuthMessage(error, 'Não foi possível criar a conta.'));
    }
    try {
      user = (await signInWithEmailAndPassword(firebaseAuth(), input.email, input.password)).user;
    } catch (signInError) {
      throw new Error(firebaseAuthMessage(signInError, 'Este e-mail já está em uso.'));
    }
  }
  try {
    if (user.displayName !== name) await updateProfile(user, { displayName: name });
    await setDoc(doc(firebaseDb(), 'users', user.uid), { email: input.email, name }, { merge: true });
    return readCloudUser(user);
  } catch (error) {
    throw new Error(firebaseAuthMessage(error, 'Não foi possível guardar o perfil.'));
  }
}

export async function loginFirebaseUser(input: { email: string; password: string }): Promise<CloudUser> {
  try {
    const credential = await signInWithEmailAndPassword(firebaseAuth(), input.email, input.password);
    return readCloudUser(credential.user);
  } catch (error) {
    throw new Error(firebaseAuthMessage(error, 'Não foi possível entrar.'));
  }
}

export async function readCloudUser(user: User): Promise<CloudUser> {
  const snapshot = await getDoc(doc(firebaseDb(), 'users', user.uid));
  const data = snapshot.data() as Partial<UserRecord> | undefined;
  return {
    uid: user.uid,
    email: data?.email ?? user.email ?? '',
    name: data?.name ?? user.displayName ?? '',
    profile: data?.profile ?? null,
    preferences: { ...defaultPreferences, ...data?.preferences },
  };
}

export async function saveCloudProfile(uid: string, profile: RunnerProfile | null, name?: string): Promise<void> {
  await setDoc(doc(firebaseDb(), 'users', uid), { profile, ...(name ? { name } : {}) }, { merge: true });
}

export async function saveCloudPreferences(uid: string, preferences: Preferences): Promise<void> {
  await setDoc(doc(firebaseDb(), 'users', uid), { preferences }, { merge: true });
}

export async function signOutFirebase(): Promise<void> {
  if (!firebaseConfigured()) return;
  await signOut(firebaseAuth());
}

function firebaseAuthMessage(error: unknown, fallback: string): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (code === 'auth/email-already-in-use') return 'Este e-mail já está em uso.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-email') {
    return 'E-mail ou senha inválidos.';
  }
  if (code === 'auth/weak-password') return 'A senha precisa ter pelo menos 8 caracteres.';
  if (code === 'auth/network-request-failed') return 'Sem conexão. Tente de novo quando a internet voltar.';
  if (code === 'auth/too-many-requests') return 'Muitas tentativas. Espere um pouco e tente de novo.';
  if (code === 'auth/configuration-not-found' || code === 'auth/operation-not-allowed') {
    return 'Ative o login por e-mail no Firebase: Authentication, depois E-mail/senha.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Este endereço não está autorizado. Inclua o domínio em Authentication, Configurações, Domínios autorizados.';
  }
  if (code === 'permission-denied' || code === 'auth/insufficient-permission') {
    return 'A conta já existe. No Firestore, abra Regras, troque o if false pelas regras do projeto e publique. Depois toque em Criar conta de novo.';
  }
  return fallback;
}

function hasCode(error: unknown, expected: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === expected;
}
