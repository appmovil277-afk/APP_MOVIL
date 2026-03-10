import {
  AuditEntry,
  MailQueueItem,
  SyncJob,
  SystemHealth,
  WorkspaceState,
} from '../types';

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createSyncJob(input: {
  action: string;
  entityId: string;
  entityType: SyncJob['entityType'];
  message: string;
  orderId?: string;
}): SyncJob {
  return {
    id: uid('sync'),
    action: input.action,
    entityId: input.entityId,
    entityType: input.entityType,
    message: input.message,
    orderId: input.orderId,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}

export function createAuditEntry(input: {
  action: string;
  actorId: string;
  detail: string;
  orderId?: string;
}): AuditEntry {
  return {
    id: uid('audit'),
    action: input.action,
    actorId: input.actorId,
    detail: input.detail,
    orderId: input.orderId,
    createdAt: new Date().toISOString(),
  };
}

export function createMailQueueItem(input: {
  orderId: string;
  recipient: string;
  subject: string;
  body: string;
  pdfRequested: boolean;
}): MailQueueItem {
  return {
    id: uid('mail'),
    orderId: input.orderId,
    recipient: input.recipient,
    subject: input.subject,
    body: input.body,
    pdfRequested: input.pdfRequested,
    status: 'prepared',
    createdAt: new Date().toISOString(),
  };
}

export function markSyncJobsSynced(jobs: SyncJob[]) {
  return jobs.map((job) =>
    job.status === 'pending'
      ? {
          ...job,
          status: 'synced' as const,
          lastAttemptAt: new Date().toISOString(),
        }
      : job,
  );
}

export function computeSystemHealth(workspace: WorkspaceState): SystemHealth {
  const overdueOrders = workspace.orders.filter((order) => {
    if (order.status === 'completed') {
      return false;
    }

    return new Date(order.dueDate).getTime() < Date.now();
  }).length;

  const queueDepth = workspace.syncQueue.filter((job) => job.status === 'pending').length;
  const pendingEmails = workspace.mailQueue.filter((item) => item.status !== 'sent').length;
  const unreadNotifications = workspace.notifications.filter((item) => !item.read).length;

  let syncStatus: SystemHealth['syncStatus'] = 'healthy';

  if (queueDepth > 8 || overdueOrders > 2) {
    syncStatus = 'critical';
  } else if (queueDepth > 3 || overdueOrders > 0 || pendingEmails > 3) {
    syncStatus = 'warning';
  }

  return {
    syncStatus,
    queueDepth,
    pendingEmails,
    unreadNotifications,
    overdueOrders,
  };
}
