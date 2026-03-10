import AsyncStorage from '@react-native-async-storage/async-storage';
import { seedWorkspace } from '../data/seed';
import { AuthSession, WorkspaceState } from '../types';
import { markSyncJobsSynced } from '../utils/backend';
import { isFirebaseConfigured, loadWorkspaceFromFirebase, saveWorkspaceToFirebase } from './firebase';

const STORAGE_KEY = 'tallerflow/workspace';
const SESSION_KEY = 'tallerflow/session';
const THEME_MODE_KEY = 'tallerflow/theme-mode';

export async function loadWorkspace(): Promise<{
  workspace: WorkspaceState;
  mode: 'local' | 'firebase';
}> {
  const localValue = await AsyncStorage.getItem(STORAGE_KEY);

  if (localValue) {
    return {
      workspace: JSON.parse(localValue) as WorkspaceState,
      mode: 'local',
    };
  }

  if (isFirebaseConfigured) {
    const remote = await loadWorkspaceFromFirebase();

    if (remote) {
      const workspace = {
        ...seedWorkspace,
        ...remote,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
      return { workspace, mode: 'firebase' };
    }
  }

  return {
    workspace: seedWorkspace,
    mode: 'local',
  };
}

export async function persistWorkspace(workspace: WorkspaceState) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));

  if (!isFirebaseConfigured) {
    return {
      mode: 'local' as const,
      workspace,
    };
  }

  const synced = await saveWorkspaceToFirebase(workspace);
  const nextWorkspace = synced
    ? {
        ...workspace,
        syncQueue: markSyncJobsSynced(workspace.syncQueue),
        lastSyncedAt: new Date().toISOString(),
      }
    : workspace;

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextWorkspace));

  return {
    mode: synced ? ('firebase' as const) : ('local' as const),
    workspace: nextWorkspace,
  };
}

export async function loadSession(): Promise<AuthSession | null> {
  const value = await AsyncStorage.getItem(SESSION_KEY);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as AuthSession;
  } catch {
    await AsyncStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export async function persistSession(session: AuthSession) {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function loadThemeMode(): Promise<'dark' | 'light'> {
  const value = await AsyncStorage.getItem(THEME_MODE_KEY);
  return value === 'light' ? 'light' : 'dark';
}

export async function persistThemeMode(mode: 'dark' | 'light') {
  await AsyncStorage.setItem(THEME_MODE_KEY, mode);
}
