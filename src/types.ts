export type RoleId =
  | 'comercial'
  | 'administracion'
  | 'diseno'
  | 'carpinteria'
  | 'tapiceria'
  | 'calidad'
  | 'despacho';

export type OrderStatus =
  | 'pending_approval'
  | 'approved'
  | 'in_progress'
  | 'blocked'
  | 'completed';

export type StageStatus = 'pending' | 'active' | 'completed' | 'blocked';

export type Priority = 'Alta' | 'Media' | 'Baja';

export type NotificationChannel = 'Push' | 'Email' | 'In-app' | 'WhatsApp';

export type PayoutRule =
  | 'Al registrar'
  | 'Al aprobar'
  | 'Al iniciar'
  | 'Al finalizar'
  | 'Contra entrega';

export type NavigationTab =
  | 'dashboard'
  | 'solicitudes'
  | 'administracion'
  | 'flujo'
  | 'notificaciones'
  | 'clientes'
  | 'equipo'
  | 'mejoras'
  | 'mas';

export type EmployeeAvailability = 'Disponible' | 'Ocupado' | 'Ausente';

export type ImprovementState = 'Activa' | 'Preparada';

export type SyncJobStatus = 'pending' | 'synced' | 'failed';

export type EmailQueueStatus = 'pending' | 'prepared' | 'sent' | 'failed';

export type HealthStatus = 'healthy' | 'warning' | 'critical';

export type Client = {
  name: string;
  email: string;
  phone: string;
  city: string;
};

export type OrderDraft = {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientCity: string;
  furnitureName: string;
  material: string;
  size: string;
  needsCushions: boolean;
  estimatedCost: string;
  dueDate: string;
  notes: string;
};

export type OrderEvent = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  actorId: string;
};

export type WorkflowStage = {
  id: string;
  title: string;
  role: RoleId;
  assigneeId: string;
  status: StageStatus;
  payout: number;
  payoutRule: PayoutRule;
  note: string;
  startedAt?: string;
  completedAt?: string;
};

export type FurnitureOrder = {
  id: string;
  reference: string;
  createdAt: string;
  updatedAt: string;
  createdByEmployeeId: string;
  client: Client;
  furnitureName: string;
  material: string;
  size: string;
  needsCushions: boolean;
  estimatedCost: number;
  dueDate: string;
  notes: string;
  status: OrderStatus;
  priority: Priority;
  pricing: {
    productionCost: number;
    finalPrice: number;
    expectedMargin: number;
    adminNote: string;
  };
  stages: WorkflowStage[];
  events: OrderEvent[];
  tags: string[];
};

export type Employee = {
  id: string;
  name: string;
  role: RoleId;
  email: string;
  phone: string;
  avatarUri?: string;
  accent: string;
  baseRate: number;
  availability: EmployeeAvailability;
  specialties: string[];
  performance: number;
};

export type AuthSession = {
  employeeId: string;
  signedInAt: string;
};

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  priority: Priority;
  channels: NotificationChannel[];
  orderId?: string;
  recipients: string[];
  read: boolean;
  actionLabel?: string;
};

export type SyncJob = {
  id: string;
  entityId: string;
  entityType: 'workspace' | 'order' | 'notification' | 'mailQueue';
  action: string;
  status: SyncJobStatus;
  createdAt: string;
  message: string;
  orderId?: string;
  lastAttemptAt?: string;
};

export type MailQueueItem = {
  id: string;
  orderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: EmailQueueStatus;
  createdAt: string;
  pdfRequested: boolean;
};

export type AuditEntry = {
  id: string;
  action: string;
  actorId: string;
  createdAt: string;
  detail: string;
  orderId?: string;
};

export type SystemHealth = {
  syncStatus: HealthStatus;
  queueDepth: number;
  pendingEmails: number;
  unreadNotifications: number;
  overdueOrders: number;
};

export type NotificationSettings = {
  autoClientEmail: boolean;
  overdueEscalationHours: number;
  digestAt: string;
  highPriorityPush: boolean;
};

export type WorkspaceState = {
  employees: Employee[];
  orders: FurnitureOrder[];
  notifications: AppNotification[];
  syncQueue: SyncJob[];
  mailQueue: MailQueueItem[];
  auditLog: AuditEntry[];
  notificationSettings: NotificationSettings;
  lastSyncedAt?: string;
};

export type ImprovementCategory = {
  id: string;
  title: string;
  accent: string;
  state: ImprovementState;
  items: string[];
};
