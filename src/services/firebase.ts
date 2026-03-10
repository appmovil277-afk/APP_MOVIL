import { getApps, initializeApp } from 'firebase/app';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  writeBatch,
} from 'firebase/firestore';
import { WorkspaceState } from '../types';
import { sanitizeForFirestore } from '../utils/order';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

function getDb() {
  if (!isFirebaseConfigured) {
    return null;
  }

  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  return getFirestore(app);
}

export async function loadWorkspaceFromFirebase() {
  const db = getDb();

  if (!db) {
    return null;
  }

  const [
    employeesSnapshot,
    ordersSnapshot,
    notificationsSnapshot,
    syncQueueSnapshot,
    mailQueueSnapshot,
    auditLogSnapshot,
    settingsDoc,
  ] = await Promise.all([
    getDocs(collection(db, 'employees')),
    getDocs(collection(db, 'orders')),
    getDocs(collection(db, 'notifications')),
    getDocs(collection(db, 'syncQueue')),
    getDocs(collection(db, 'mailQueue')),
    getDocs(collection(db, 'auditLog')),
    getDoc(doc(db, 'settings', 'workspace')),
  ]);

  if (
    employeesSnapshot.empty &&
    ordersSnapshot.empty &&
    notificationsSnapshot.empty &&
    syncQueueSnapshot.empty &&
    mailQueueSnapshot.empty &&
    auditLogSnapshot.empty &&
    !settingsDoc.exists()
  ) {
    return null;
  }

  return {
    employees: employeesSnapshot.docs.map((item) => item.data()),
    orders: ordersSnapshot.docs.map((item) => item.data()),
    notifications: notificationsSnapshot.docs.map((item) => item.data()),
    syncQueue: syncQueueSnapshot.docs.map((item) => item.data()),
    mailQueue: mailQueueSnapshot.docs.map((item) => item.data()),
    auditLog: auditLogSnapshot.docs.map((item) => item.data()),
    notificationSettings: settingsDoc.exists()
      ? settingsDoc.data().notificationSettings
      : undefined,
    lastSyncedAt: settingsDoc.exists() ? settingsDoc.data().lastSyncedAt : undefined,
  } as Partial<WorkspaceState>;
}

export async function saveWorkspaceToFirebase(state: WorkspaceState) {
  const db = getDb();

  if (!db) {
    return false;
  }

  const batch = writeBatch(db);

  state.employees.forEach((employee) => {
    batch.set(doc(db, 'employees', employee.id), sanitizeForFirestore(employee));
  });

  state.orders.forEach((order) => {
    batch.set(doc(db, 'orders', order.id), sanitizeForFirestore(order));
  });

  state.notifications.forEach((notification) => {
    batch.set(doc(db, 'notifications', notification.id), sanitizeForFirestore(notification));
  });

  state.syncQueue.forEach((item) => {
    batch.set(doc(db, 'syncQueue', item.id), sanitizeForFirestore(item));
  });

  state.mailQueue.forEach((item) => {
    batch.set(doc(db, 'mailQueue', item.id), sanitizeForFirestore(item));
  });

  state.auditLog.forEach((item) => {
    batch.set(doc(db, 'auditLog', item.id), sanitizeForFirestore(item));
  });

  batch.set(
    doc(db, 'settings', 'workspace'),
    sanitizeForFirestore({
      notificationSettings: state.notificationSettings,
      lastSyncedAt: new Date().toISOString(),
    }),
  );

  await batch.commit();
  return true;
}
