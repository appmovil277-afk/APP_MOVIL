import {
  AppNotification,
  Employee,
  FurnitureOrder,
  OrderDraft,
  OrderEvent,
  OrderStatus,
  PayoutRule,
  Priority,
  RoleId,
  WorkflowStage,
} from '../types';

type StageBlueprint = {
  title: string;
  role: RoleId;
  payout: number;
  payoutRule: PayoutRule;
  note: string;
  locked?: boolean;
};

export const stageBlueprints: StageBlueprint[] = [
  {
    title: 'Solicitud comercial',
    role: 'comercial',
    payout: 30000,
    payoutRule: 'Al registrar',
    note: 'Registro inicial del requerimiento del cliente.',
    locked: true,
  },
  {
    title: 'Validación administrativa',
    role: 'administracion',
    payout: 45000,
    payoutRule: 'Al aprobar',
    note: 'Aprobación, precio final, margen y orden del flujo.',
    locked: true,
  },
  {
    title: 'Diseño técnico',
    role: 'diseno',
    payout: 60000,
    payoutRule: 'Al finalizar',
    note: 'Ajuste de planos y detalles de fabricación.',
  },
  {
    title: 'Carpintería',
    role: 'carpinteria',
    payout: 120000,
    payoutRule: 'Al finalizar',
    note: 'Estructura, corte y ensamble principal.',
  },
  {
    title: 'Tapicería',
    role: 'tapiceria',
    payout: 95000,
    payoutRule: 'Al finalizar',
    note: 'Forrado, costuras y montaje textil.',
  },
  {
    title: 'Control de calidad',
    role: 'calidad',
    payout: 50000,
    payoutRule: 'Al finalizar',
    note: 'Inspección final antes de despacho.',
  },
  {
    title: 'Despacho',
    role: 'despacho',
    payout: 40000,
    payoutRule: 'Contra entrega',
    note: 'Preparación de salida y entrega al cliente.',
  },
];

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function findEmployeeByRole(employees: Employee[], role: RoleId) {
  return (
    employees.find((employee) => employee.role === role && employee.availability !== 'Ausente') ??
    employees.find((employee) => employee.role === role) ??
    employees[0]
  );
}

function getPriorityFromDueDate(dueDate: string): Priority {
  const due = new Date(dueDate).getTime();
  const now = Date.now();
  const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

  if (diffDays <= 4) {
    return 'Alta';
  }

  if (diffDays <= 10) {
    return 'Media';
  }

  return 'Baja';
}

export function createOrderEvent(
  actorId: string,
  title: string,
  body: string,
  type = 'system',
): OrderEvent {
  return {
    id: uid('evt'),
    actorId,
    title,
    body,
    type,
    createdAt: new Date().toISOString(),
  };
}

export function createNotification(
  title: string,
  body: string,
  recipients: string[],
  priority: Priority,
  orderId?: string,
  actionLabel?: string,
): AppNotification {
  return {
    id: uid('ntf'),
    title,
    body,
    createdAt: new Date().toISOString(),
    priority,
    channels: ['In-app', 'Push', 'Email'],
    orderId,
    recipients,
    read: false,
    actionLabel,
  };
}

export function buildOrderFromDraft(
  draft: OrderDraft,
  employees: Employee[],
  createdByEmployeeId: string,
  orderCount = 0,
  customStages?: Array<{ role: RoleId; title: string; payout: number; payoutRule: PayoutRule }>,
): FurnitureOrder {
  const createdAt = new Date().toISOString();
  const reference = `#${orderCount + 1}`;
  const salesperson = employees.find((employee) => employee.id === createdByEmployeeId) ?? employees[0];
  const estimatedCost = Number(draft.estimatedCost) || 0;

  const adminEmployee = findEmployeeByRole(employees, 'administracion');

  const blueprints = customStages
    ? [stageBlueprints[0], stageBlueprints[1], ...customStages.map((s) => ({ ...s, note: '', locked: false }))]
    : stageBlueprints;

  const stages: WorkflowStage[] = blueprints.map((blueprint, index) => {
    // Stage 0 = comercial (auto-assigned to creator), Stage 1 = admin (auto-assigned)
    // All other stages start unassigned — admin must choose in Tareas
    const assigneeId =
      index === 0
        ? salesperson.id
        : index === 1
          ? adminEmployee.id
          : '';

    return {
      id: uid('stg'),
      title: blueprint.title,
      role: blueprint.role,
      assigneeId,
      status: index === 0 ? 'completed' : 'pending',
      payout: blueprint.payout,
      payoutRule: blueprint.payoutRule,
      note: blueprint.note,
      startedAt: index === 0 ? createdAt : undefined,
      completedAt: index === 0 ? createdAt : undefined,
    };
  });

  return {
    id: uid('ord'),
    reference,
    createdAt,
    updatedAt: createdAt,
    createdByEmployeeId,
    client: {
      name: draft.clientName,
      email: draft.clientEmail,
      phone: draft.clientPhone,
      city: draft.clientCity,
    },
    furnitureName: draft.furnitureName,
    material: draft.material,
    size: draft.size,
    needsCushions: draft.needsCushions,
    estimatedCost,
    dueDate: draft.dueDate,
    notes: draft.notes,
    status: 'pending_approval',
    priority: getPriorityFromDueDate(draft.dueDate),
    pricing: {
      productionCost: estimatedCost,
      finalPrice: Math.round(estimatedCost * 1.45),
      expectedMargin: Math.max(Math.round(estimatedCost * 0.45), 0),
      adminNote: '',
    },
    stages,
    tags: [draft.material, draft.needsCushions ? 'Con almohadas' : 'Sin almohadas', draft.size],
    events: [
      createOrderEvent(
        createdByEmployeeId,
        'Solicitud creada',
        `El comercial registró el pedido ${reference} para ${draft.clientName}.`,
        'commercial',
      ),
    ],
  };
}

export function getOrderProgress(order: FurnitureOrder) {
  const completed = order.stages.filter((stage) => stage.status === 'completed').length;
  return Math.round((completed / order.stages.length) * 100);
}

export function getCurrentExecutableStage(order: FurnitureOrder) {
  return order.stages.find((stage, index) => {
    if (stage.status !== 'pending') {
      return false;
    }

    return order.stages.slice(0, index).every((item) => item.status === 'completed');
  });
}

export function getActiveStage(order: FurnitureOrder) {
  return order.stages.find((stage) => stage.status === 'active') ?? getCurrentExecutableStage(order);
}

export function deriveOrderStatus(order: FurnitureOrder): OrderStatus {
  if (order.stages.every((stage) => stage.status === 'completed')) {
    return 'completed';
  }

  if (order.stages.some((stage) => stage.status === 'blocked')) {
    return 'blocked';
  }

  if (order.stages.some((stage, index) => stage.status === 'active' && index > 1)) {
    return 'in_progress';
  }

  if (order.stages[1]?.status === 'completed') {
    return 'approved';
  }

  return 'pending_approval';
}

export function updateMargins(order: FurnitureOrder) {
  return {
    ...order,
    pricing: {
      ...order.pricing,
      expectedMargin: Math.max(order.pricing.finalPrice - order.pricing.productionCost, 0),
    },
  };
}

export function sanitizeForFirestore<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
