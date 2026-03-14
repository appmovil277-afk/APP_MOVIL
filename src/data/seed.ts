import { Employee, NotificationSettings, OrderDraft, WorkspaceState } from '../types';
import {
  buildOrderFromDraft,
  createNotification,
  createOrderEvent,
  deriveOrderStatus,
  updateMargins,
} from '../utils/order';
import { createAuditEntry, createMailQueueItem, createSyncJob } from '../utils/backend';

function avatarUri(name: string) {
  return `https://api.dicebear.com/9.x/initials/png?seed=${encodeURIComponent(name)}&backgroundType=gradientLinear`;
}

export const employees: Employee[] = [
  {
    id: 'emp-com-1',
    name: 'Laura Díaz',
    role: 'comercial',
    email: 'laura@tallerflow.co',
    phone: '+57 300 111 2233',
    accent: '#c27d22',
    baseRate: 30000,
    availability: 'Disponible',
    specialties: ['Cotización', 'Relación cliente'],
    performance: 92,
    avatarUri: avatarUri('Laura Díaz'),
  },
  {
    id: 'emp-adm-1',
    name: 'Mateo Ruiz',
    role: 'administracion',
    email: 'mateo@tallerflow.co',
    phone: '+57 300 111 4455',
    accent: '#0f766e',
    baseRate: 45000,
    availability: 'Disponible',
    specialties: ['Costos', 'Programación'],
    performance: 89,
    avatarUri: avatarUri('Mateo Ruiz'),
  },
  {
    id: 'emp-dis-1',
    name: 'Camila Soto',
    role: 'diseno',
    email: 'camila@tallerflow.co',
    phone: '+57 300 111 6677',
    accent: '#184e77',
    baseRate: 60000,
    availability: 'Disponible',
    specialties: ['Planos', 'Despiece'],
    performance: 94,
    avatarUri: avatarUri('Camila Soto'),
  },
  {
    id: 'emp-car-1',
    name: 'Javier Peña',
    role: 'carpinteria',
    email: 'javier@tallerflow.co',
    phone: '+57 300 111 8899',
    accent: '#7f5539',
    baseRate: 120000,
    availability: 'Ocupado',
    specialties: ['Corte', 'Ensamble'],
    performance: 87,
    avatarUri: avatarUri('Javier Peña'),
  },
  {
    id: 'emp-tap-1',
    name: 'Daniela Ríos',
    role: 'tapiceria',
    email: 'daniela@tallerflow.co',
    phone: '+57 300 222 1133',
    accent: '#8d5a97',
    baseRate: 95000,
    availability: 'Disponible',
    specialties: ['Costuras', 'Acabados blandos'],
    performance: 91,
    avatarUri: avatarUri('Daniela Ríos'),
  },
  {
    id: 'emp-cal-1',
    name: 'Sofía Lara',
    role: 'calidad',
    email: 'sofia@tallerflow.co',
    phone: '+57 300 222 3355',
    accent: '#577590',
    baseRate: 50000,
    availability: 'Disponible',
    specialties: ['Checklist', 'Liberación'],
    performance: 96,
    avatarUri: avatarUri('Sofía Lara'),
  },
  {
    id: 'emp-des-1',
    name: 'Esteban Cruz',
    role: 'despacho',
    email: 'esteban@tallerflow.co',
    phone: '+57 300 222 5577',
    accent: '#3d405b',
    baseRate: 40000,
    availability: 'Disponible',
    specialties: ['Logística', 'Entrega'],
    performance: 88,
    avatarUri: avatarUri('Esteban Cruz'),
  },
];

export const notificationSettings: NotificationSettings = {
  autoClientEmail: true,
  overdueEscalationHours: 12,
  digestAt: '07:30',
  highPriorityPush: true,
};

export const emptyOrderDraft: OrderDraft = {
  clientName: '',
  clientEmail: '',
  clientPhone: '',
  clientCity: '',
  furnitureName: '',
  material: 'Madera flor morado',
  size: '2.00m x 0.90m x 0.85m',
  needsCushions: true,
  estimatedCost: '',
  dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 12).toISOString(),
  notes: '',
};

const draftA: OrderDraft = {
  clientName: 'Ana Mejía',
  clientEmail: 'ana.mejia@cliente.co',
  clientPhone: '+57 310 555 1100',
  clientCity: 'Bogotá',
  furnitureName: 'Sofá modular Oslo',
  material: 'Madera flor morado',
  size: '2.80m x 0.95m x 0.90m',
  needsCushions: true,
  estimatedCost: '3200000',
  dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 8).toISOString(),
  notes: 'Tela antimanchas color arena y dos módulos desmontables.',
};

const draftB: OrderDraft = {
  clientName: 'Carlos Varela',
  clientEmail: 'carlos.varela@cliente.co',
  clientPhone: '+57 320 555 2200',
  clientCity: 'Medellín',
  furnitureName: 'Poltrona Verona',
  material: 'Cedro',
  size: '0.95m x 0.90m x 1.10m',
  needsCushions: false,
  estimatedCost: '1450000',
  dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 15).toISOString(),
  notes: 'Brazo curvo y base reforzada para sala de espera.',
};

const draftC: OrderDraft = {
  clientName: 'Mariana Torres',
  clientEmail: 'mariana.torres@cliente.co',
  clientPhone: '+57 315 555 3344',
  clientCity: 'Cali',
  furnitureName: 'Cabecero Niza',
  material: 'Roble',
  size: '1.80m x 0.12m x 1.30m',
  needsCushions: false,
  estimatedCost: '2100000',
  dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
  notes: 'Debe incluir canal para iluminación LED.',
};

const orderA = (() => {
  let order = buildOrderFromDraft(draftA, employees, 'emp-com-1', 0);
  order.stages[1].status = 'completed';
  order.stages[1].startedAt = new Date(Date.now() - 1000 * 60 * 60 * 42).toISOString();
  order.stages[1].completedAt = new Date(Date.now() - 1000 * 60 * 60 * 40).toISOString();
  order.stages[2].status = 'active';
  order.stages[2].startedAt = new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString();
  order.pricing.finalPrice = 4680000;
  order = updateMargins(order);
  order.events.push(
    createOrderEvent('emp-adm-1', 'Pedido aprobado', 'Administración aprobó el pedido y liberó producción.', 'admin'),
    createOrderEvent('emp-dis-1', 'Diseño en curso', 'El área de diseño técnico inició el detalle del sofá.', 'workflow'),
  );
  order.status = deriveOrderStatus(order);
  return order;
})();

const orderB = (() => {
  let order = buildOrderFromDraft(draftB, employees, 'emp-com-1', 1);
  order.stages[1].status = 'pending';
  order.pricing.finalPrice = 2240000;
  order = updateMargins(order);
  order.events.push(
    createOrderEvent('emp-com-1', 'Esperando aprobación', 'El pedido quedó en cola administrativa.', 'admin'),
  );
  order.status = deriveOrderStatus(order);
  return order;
})();

const orderC = (() => {
  let order = buildOrderFromDraft(draftC, employees, 'emp-com-1', 2);
  order.stages[1].status = 'completed';
  order.stages[1].startedAt = new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString();
  order.stages[1].completedAt = new Date(Date.now() - 1000 * 60 * 60 * 70).toISOString();
  order.stages[2].status = 'completed';
  order.stages[2].startedAt = new Date(Date.now() - 1000 * 60 * 60 * 68).toISOString();
  order.stages[2].completedAt = new Date(Date.now() - 1000 * 60 * 60 * 54).toISOString();
  order.stages[3].status = 'completed';
  order.stages[3].startedAt = new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString();
  order.stages[3].completedAt = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
  order.stages[4].status = 'active';
  order.stages[4].startedAt = new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString();
  order.pricing.finalPrice = 3210000;
  order = updateMargins(order);
  order.events.push(
    createOrderEvent('emp-adm-1', 'Pedido aprobado', 'Administración ajustó precio y margen.', 'admin'),
    createOrderEvent('emp-dis-1', 'Diseño completado', 'Se validó la integración de iluminación LED.', 'workflow'),
    createOrderEvent('emp-car-1', 'Carpintería completada', 'Se entregó estructura al área de tapicería.', 'workflow'),
    createOrderEvent('emp-tap-1', 'Tapicería en curso', 'La etapa de tapicería está en proceso.', 'workflow'),
  );
  order.status = deriveOrderStatus(order);
  return order;
})();

export const seedWorkspace: WorkspaceState = {
  employees,
  orders: [orderA, orderB, orderC],
  notifications: [
    createNotification(
      'Pedido listo para aprobar',
      'La poltrona Verona quedó pendiente de validación administrativa.',
      ['Mateo Ruiz'],
      'Alta',
      orderB.id,
      'Revisar pedido',
    ),
    createNotification(
      'Diseño técnico activo',
      'Camila Soto está trabajando en el sofá modular Oslo.',
      ['Camila Soto', 'Mateo Ruiz'],
      'Media',
      orderA.id,
      'Ver flujo',
    ),
    createNotification(
      'Tapicería debe cerrar hoy',
      'El cabecero Niza vencerá pronto si no se completa tapicería hoy.',
      ['Daniela Ríos', 'Sofía Lara'],
      'Alta',
      orderC.id,
      'Priorizar',
    ),
  ],
  syncQueue: [
    createSyncJob({
      action: 'seed_workspace',
      entityId: 'workspace-seed',
      entityType: 'workspace',
      message: 'Carga inicial del espacio de trabajo.',
    }),
    createSyncJob({
      action: 'approve_order',
      entityId: orderA.id,
      entityType: 'order',
      orderId: orderA.id,
      message: 'Aprobacion inicial pendiente de confirmar con la nube.',
    }),
  ],
  mailQueue: [
    createMailQueueItem({
      orderId: orderA.id,
      recipient: orderA.client.email,
      subject: `Seguimiento ${orderA.reference}`,
      body: 'Resumen listo para enviar al cliente.',
      pdfRequested: true,
    }),
  ],
  auditLog: [
    createAuditEntry({
      action: 'create_order',
      actorId: 'emp-com-1',
      orderId: orderA.id,
      detail: 'Laura creo el pedido inicial de sofa modular.',
    }),
    createAuditEntry({
      action: 'approve_order',
      actorId: 'emp-adm-1',
      orderId: orderA.id,
      detail: 'Mateo aprobo el pedido y asigno responsables.',
    }),
    createAuditEntry({
      action: 'start_stage',
      actorId: 'emp-dis-1',
      orderId: orderA.id,
      detail: 'Diseno tecnico fue iniciado por Camila.',
    }),
  ],
  notificationSettings,
  lastSyncedAt: undefined,
};
