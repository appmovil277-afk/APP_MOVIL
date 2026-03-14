import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { createContext, startTransition, useContext, useDeferredValue, useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { improvementCategories, totalImprovements } from './src/constants/improvements';
import { AppTheme, darkTheme, lightTheme } from './src/constants/theme';
import { emptyOrderDraft, seedWorkspace } from './src/data/seed';
import { prepareLocalNotifications, sendLocalNotification } from './src/services/notifications';
import { composeOrderEmail, createOrderPdf, sharePdf } from './src/services/pdf';
import { clearSession, loadSession, loadThemeMode, loadWorkspace, persistSession, persistThemeMode, persistWorkspace } from './src/services/repository';
import { AppNotification, AuthSession, Employee, FurnitureOrder, NavigationTab, OrderDraft, PayoutRule, Priority, RoleId, WorkspaceState } from './src/types';
import { clampNumber, formatCurrency, formatDate, formatDateOnly, getDaysRemaining, getOrderStatusLabel, getRoleLabel, getStageStatusLabel } from './src/utils/format';
import { computeSystemHealth, createAuditEntry, createMailQueueItem, createSyncJob } from './src/utils/backend';
import { buildOrderFromDraft, createNotification, createOrderEvent, deriveOrderStatus, findEmployeeByRole, getActiveStage, getCurrentExecutableStage, getOrderProgress, updateMargins } from './src/utils/order';

const MATERIALS = ['Madera flor morado', 'Cedro', 'Roble', 'Nogal', 'Melamina RH', 'Metal y madera'];
const PAY_RULES: PayoutRule[] = ['Al registrar', 'Al aprobar', 'Al iniciar', 'Al finalizar', 'Contra entrega'];
const PAYMENT_METHODS = ['Efectivo', 'Nequi', 'Daviplata', 'Bancolombia', 'Transferencia'];
const DEMO_PASSWORD = 'TallerFlow2026';

type DraftStageItem = { role: RoleId; title: string; payout: number; payoutRule: PayoutRule };

const STAGE_OPTIONS: DraftStageItem[] = [
  { role: 'diseno',      title: 'Diseño técnico',      payout: 60000,  payoutRule: 'Al finalizar' },
  { role: 'carpinteria', title: 'Carpintería',          payout: 120000, payoutRule: 'Al finalizar' },
  { role: 'tapiceria',   title: 'Tapicería',            payout: 95000,  payoutRule: 'Al finalizar' },
  { role: 'calidad',     title: 'Control de calidad',   payout: 50000,  payoutRule: 'Al finalizar' },
  { role: 'despacho',    title: 'Despacho',             payout: 40000,  payoutRule: 'Contra entrega' },
];

const FLOW_TEMPLATES: { label: string; stages: DraftStageItem[] }[] = [
  { label: 'Flujo completo', stages: [...STAGE_OPTIONS] },
  { label: 'Sin diseño',     stages: STAGE_OPTIONS.filter((s) => s.role !== 'diseno') },
  { label: 'Solo tapicería', stages: STAGE_OPTIONS.filter((s) => ['tapiceria', 'calidad', 'despacho'].includes(s.role)) },
  { label: 'Vacío',          stages: [] },
];

type BottomTabItem = { key: NavigationTab; label: string; icon: string };

function freshDraft(): OrderDraft {
  return { ...emptyOrderDraft, dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 12).toISOString() };
}

function stamp(workspace: WorkspaceState): WorkspaceState {
  return { ...workspace, lastSyncedAt: new Date().toISOString() };
}

function BackgroundGlow() {
  const { theme, styles } = useContext(ThemeContext);
  return (
    <View pointerEvents="none" style={styles.backdrop}>
      {/* ── Aurora Layer 1: Primary orbs ── */}
      <LinearGradient colors={[theme.glowBlue,   'transparent']} start={{ x: 0.5, y: 0.5 }} end={{ x: 1, y: 1 }}   style={[styles.orb, styles.orbTop]}   />
      <LinearGradient colors={[theme.glowPink,   'transparent']} start={{ x: 0.5, y: 0.5 }} end={{ x: 0, y: 0 }}   style={[styles.orb, styles.orbSide]}  />
      <LinearGradient colors={[theme.glowMint,   'transparent']} start={{ x: 0.5, y: 0.5 }} end={{ x: 0, y: 0 }}   style={[styles.orb, styles.orbBottom]}/>
      {/* ── Aurora Layer 2: Depth orbs ── */}
      <LinearGradient colors={[theme.glowIndigo, 'transparent']} start={{ x: 0.5, y: 0.5 }} end={{ x: 0,   y: 1 }} style={[styles.orb, styles.orbDeep]} />
      <LinearGradient colors={[theme.glowAmber,  'transparent']} start={{ x: 0.5, y: 0.5 }} end={{ x: 1,   y: 0 }} style={[styles.orb, styles.orbWarm]} />
      <LinearGradient colors={[theme.glowIndigo, 'transparent']} start={{ x: 0.5, y: 0   }} end={{ x: 0.5, y: 1 }} style={[styles.orb, styles.orbStage]}/>
    </View>
  );
}

function getTabsForRole(role: RoleId): BottomTabItem[] {
  if (role === 'comercial') {
    return [
      { key: 'home',          label: 'Inicio',      icon: 'home-outline' },
      { key: 'solicitudes',   label: 'Formulario',  icon: 'document-text-outline' },
      { key: 'flujo',         label: 'Mis pedidos', icon: 'play-circle-outline' },
      { key: 'notificaciones',label: 'Alertas',     icon: 'notifications-outline' },
      { key: 'ajustes',       label: 'Ajustes',     icon: 'settings-outline' },
    ];
  }

  if (role === 'administracion') {
    return [
      { key: 'home',          label: 'Inicio',   icon: 'home-outline' },
      { key: 'solicitudes',   label: 'Crear',    icon: 'document-text-outline' },
      { key: 'flujo',         label: 'Tareas',   icon: 'play-circle-outline' },
      { key: 'notificaciones',label: 'Alertas',  icon: 'notifications-outline' },
      { key: 'ajustes',       label: 'Ajustes',  icon: 'settings-outline' },
    ];
  }

  return [
    { key: 'home',          label: 'Inicio',    icon: 'home-outline' },
    { key: 'flujo',         label: 'Tareas',    icon: 'play-circle-outline' },
    { key: 'historial',     label: 'Historial', icon: 'time-outline' },
    { key: 'notificaciones',label: 'Alertas',   icon: 'notifications-outline' },
    { key: 'ajustes',       label: 'Ajustes',   icon: 'settings-outline' },
  ];
}

function getDefaultTabForRole(role: RoleId): NavigationTab {
  return getTabsForRole(role)[0]?.key ?? 'dashboard';
}

type ThemeMode = 'dark' | 'light';
type AppStyles = ReturnType<typeof createStyles>;

const ThemeContext = createContext<{
  theme: AppTheme;
  styles: AppStyles;
}>({
  theme: darkTheme,
  styles: createStyles(darkTheme),
});

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(seedWorkspace);
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [draft, setDraft] = useState<OrderDraft>(freshDraft());
  const [selectedOrderId, setSelectedOrderId] = useState<string | undefined>(seedWorkspace.orders[0]?.id);
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncMode, setSyncMode] = useState<'local' | 'firebase'>('local');
  const [syncing, setSyncing] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState(DEMO_PASSWORD);
  const [loginError, setLoginError] = useState('');
  const [notificationQuery, setNotificationQuery] = useState('');
  const [teamQuery, setTeamQuery] = useState('');
  const [improvementQuery, setImprovementQuery] = useState('');
  const [pdfBusyOrderId, setPdfBusyOrderId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastCreatedOrder, setLastCreatedOrder] = useState<{ reference: string; clientEmail: string; clientName: string; furnitureName: string } | null>(null);
  const [expandedFlowOrderId, setExpandedFlowOrderId] = useState<string | null>(null);
  const [draftStages, setDraftStages] = useState<DraftStageItem[]>([...STAGE_OPTIONS]);
  const [showAddStage, setShowAddStage] = useState(false);
  const deferredNotificationQuery = useDeferredValue(notificationQuery);
  const deferredTeamQuery = useDeferredValue(teamQuery);
  const deferredImprovementQuery = useDeferredValue(improvementQuery);
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const styles = createStyles(theme);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      const [, loaded, savedSession, savedThemeMode] = await Promise.all([prepareLocalNotifications(), loadWorkspace(), loadSession(), loadThemeMode()]);
      if (!mounted) return;
      setWorkspace(loaded.workspace);
      setSelectedOrderId(loaded.workspace.orders[0]?.id);
      setSyncMode(loaded.mode);
      setThemeMode(savedThemeMode);
      const sessionIsValid = savedSession ? loaded.workspace.employees.some((employee) => employee.id === savedSession.employeeId) : false;
      setSession(sessionIsValid ? savedSession : null);
      if (savedSession && !sessionIsValid) {
        await clearSession();
      }
      // statusMessage silenced
      setLoading(false);
    }
    boot();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSyncing(true);
      try {
        const result = await persistWorkspace(workspace);
        if (!cancelled) {
          setSyncMode(result.mode);
          if (JSON.stringify(result.workspace.syncQueue) !== JSON.stringify(workspace.syncQueue)) {
            setWorkspace(result.workspace);
          }
        }
      } finally {
        if (!cancelled) setSyncing(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [workspace, loading]);

  useEffect(() => {
    if (loading) return;
    void persistThemeMode(themeMode);
  }, [loading, themeMode]);

  const sessionEmployee = session ? workspace.employees.find((employee) => employee.id === session.employeeId) ?? null : null;
  const activeEmployee = sessionEmployee ?? workspace.employees[0] ?? seedWorkspace.employees[0];
  const activeRole: RoleId = sessionEmployee?.role ?? activeEmployee.role;
  const roleTabs = getTabsForRole(activeRole);
  const visibleOrders = workspace.orders.filter((order) => {
    if (activeRole === 'administracion') return true;
    if (activeRole === 'comercial') return order.createdByEmployeeId === activeEmployee.id;
    return order.stages.some((stage) => stage.assigneeId === activeEmployee.id);
  });
  const selectedOrder = visibleOrders.find((order) => order.id === selectedOrderId) ?? visibleOrders[0] ?? null;
  const visibleNotifications = workspace.notifications.filter((notification) => {
    if (activeRole === 'administracion') return true;
    return notification.recipients.includes(activeEmployee.name);
  });
  const unreadCount = visibleNotifications.filter((notification) => !notification.read).length;
  const systemHealth = computeSystemHealth(workspace);
  const assignedStages = visibleOrders.flatMap((order) =>
    order.stages
      .filter((stage) => activeRole === 'administracion' || stage.assigneeId === activeEmployee.id)
      .map((stage) => ({ order, stage, employee: workspace.employees.find((item) => item.id === stage.assigneeId) })),
  );
  const pendingPayouts = workspace.orders.flatMap((order) =>
    order.stages
      .filter((stage) => stage.status === 'completed' && stage.payout > 0 && !stage.paidAt)
      .map((stage) => ({ order, stage, employee: workspace.employees.find((item) => item.id === stage.assigneeId) })),
  );
  const openAssignments = assignedStages.filter(({ stage }) => stage.status !== 'completed');
  const completedAssignments = assignedStages.filter(({ stage }) => stage.status === 'completed');
  // Orders con al menos una etapa activa/pendiente del usuario actual
  const myActiveOrders = activeRole === 'administracion'
    ? visibleOrders
    : visibleOrders.filter((order) =>
        order.stages.some((stage) =>
          stage.assigneeId === activeEmployee.id &&
          (stage.status === 'pending' || stage.status === 'active'),
        ),
      );
  // Orders con al menos una etapa completada del usuario actual
  const myCompletedOrders = visibleOrders.filter((order) =>
    order.stages.some((stage) =>
      stage.assigneeId === activeEmployee.id && stage.status === 'completed',
    ),
  );
  const pendingPayoutTotal = pendingPayouts.reduce((sum, item) => sum + item.stage.payout, 0);
  const historyFeed = visibleOrders
    .flatMap((order) => order.events.map((event) => ({ order, event })))
    .filter(({ event }) => activeRole === 'administracion' || event.actorId === activeEmployee.id)
    .sort((left, right) => new Date(right.event.createdAt).getTime() - new Date(left.event.createdAt).getTime());
  const metrics = {
    active: visibleOrders.filter((order) => order.status === 'in_progress' || order.status === 'approved').length,
    pending: visibleOrders.filter((order) => order.status === 'pending_approval').length,
    urgent: visibleOrders.filter((order) => order.priority === 'Alta' && order.status !== 'completed').length,
    margin: Math.round(visibleOrders.reduce((sum, order) => sum + order.pricing.expectedMargin, 0) / Math.max(visibleOrders.length, 1)),
    queue: workspace.syncQueue.filter((job) => job.status === 'pending').length,
  };

  useEffect(() => {
    if (!roleTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(getDefaultTabForRole(activeRole));
    }
  }, [activeRole, activeTab, roleTabs]);

  useEffect(() => {
    if (!visibleOrders.length) {
      if (selectedOrderId) setSelectedOrderId(undefined);
      return;
    }

    if (!visibleOrders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(visibleOrders[0]?.id);
    }
  }, [selectedOrderId, visibleOrders]);

  function updateDraft<K extends keyof OrderDraft>(field: K, value: OrderDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function mutate(
    updater: (current: WorkspaceState) => WorkspaceState,
    message?: string,
    notification?: AppNotification,
    backendMeta?: {
      action: string;
      detail: string;
      entityId: string;
      entityType: 'workspace' | 'order' | 'notification' | 'mailQueue';
      orderId?: string;
      mailItem?: {
        recipient: string;
        subject: string;
        body: string;
        pdfRequested: boolean;
      };
    },
  ) {
    setWorkspace((current) => {
      let next = updater(current);

      if (backendMeta) {
        next = {
          ...next,
          auditLog: [
            createAuditEntry({
              action: backendMeta.action,
              actorId: activeEmployee.id,
              detail: backendMeta.detail,
              orderId: backendMeta.orderId,
            }),
            ...next.auditLog,
          ],
          syncQueue: [
            createSyncJob({
              action: backendMeta.action,
              entityId: backendMeta.entityId,
              entityType: backendMeta.entityType,
              message: backendMeta.detail,
              orderId: backendMeta.orderId,
            }),
            ...next.syncQueue,
          ],
          mailQueue: backendMeta.mailItem
            ? [
                createMailQueueItem({
                  orderId: backendMeta.orderId ?? backendMeta.entityId,
                  recipient: backendMeta.mailItem.recipient,
                  subject: backendMeta.mailItem.subject,
                  body: backendMeta.mailItem.body,
                  pdfRequested: backendMeta.mailItem.pdfRequested,
                }),
                ...next.mailQueue,
              ]
            : next.mailQueue,
        };
      }

      return stamp(next);
    });
    if (message) setStatusMessage(message);
    if (notification) sendLocalNotification(notification);
  }

  function updateOrder(orderId: string, updater: (order: FurnitureOrder) => FurnitureOrder) {
    mutate((current) => ({ ...current, orders: current.orders.map((order) => (order.id === orderId ? updater(order) : order)) }));
  }

  const filteredNotifications = visibleNotifications.filter((notification) => {
    const haystack = `${notification.title} ${notification.body} ${notification.recipients.join(' ')}`.toLowerCase();
    return haystack.includes(deferredNotificationQuery.toLowerCase());
  });

  const filteredEmployees = workspace.employees.filter((employee) => {
    const haystack = `${employee.name} ${employee.email} ${employee.specialties.join(' ')}`.toLowerCase();
    return haystack.includes(deferredTeamQuery.toLowerCase());
  });

  const filteredImprovementCategories = improvementCategories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => item.toLowerCase().includes(deferredImprovementQuery.toLowerCase())),
    }))
    .filter((category) => category.items.length > 0);

  async function signInWithEmployee(employee: Employee) {
    setAuthBusy(true);
    setLoginError('');
    const nextSession: AuthSession = {
      employeeId: employee.id,
      signedInAt: new Date().toISOString(),
    };

    try {
      await persistSession(nextSession);
      setSession(nextSession);
      setLoginEmail(employee.email);
      setLoginPassword(DEMO_PASSWORD);
      setActiveTab(getDefaultTabForRole(employee.role));
      const nextVisibleOrder =
        employee.role === 'administracion'
          ? workspace.orders[0]
          : employee.role === 'comercial'
            ? workspace.orders.find((order) => order.createdByEmployeeId === employee.id)
            : workspace.orders.find((order) => order.stages.some((stage) => stage.assigneeId === employee.id));
      setSelectedOrderId(nextVisibleOrder?.id);
      setStatusMessage(`Sesion iniciada como ${employee.name}.`);
    } finally {
      setAuthBusy(false);
    }
  }

  async function submitLogin() {
    const normalizedEmail = loginEmail.trim().toLowerCase();
    const employee = workspace.employees.find((item) => item.email.toLowerCase() === normalizedEmail);

    if (!employee) {
      setLoginError('El correo no pertenece a un usuario de prueba.');
      return;
    }

    if (loginPassword !== DEMO_PASSWORD) {
      setLoginError('La clave demo no coincide.');
      return;
    }

    await signInWithEmployee(employee);
  }

  async function logout() {
    setAuthBusy(true);

    try {
      await clearSession();
      setSession(null);
      setActiveTab('dashboard');
      setLoginEmail('');
      setLoginPassword(DEMO_PASSWORD);
      setLoginError('');
      setStatusMessage('Sesion cerrada. Ingresa con otro perfil para probar otro flujo.');
    } finally {
      setAuthBusy(false);
    }
  }

  function toggleThemeMode(value: boolean) {
    setThemeMode(value ? 'dark' : 'light');
  }

  function createOrder() {
    if (activeRole !== 'comercial' && activeRole !== 'administracion') {
      setStatusMessage('Solo comercial o administración pueden crear solicitudes.');
      return;
    }
    if (!draft.clientName || !draft.clientEmail || !draft.furnitureName || !draft.size || !draft.estimatedCost) {
      setStatusMessage('Completa cliente, mueble, tamaño y costo.');
      return;
    }
    const order = buildOrderFromDraft(draft, workspace.employees, activeEmployee.id, workspace.orders.length, draftStages);
    const admin = findEmployeeByRole(workspace.employees, 'administracion');
    const adminNotification = createNotification('Nuevo pedido pendiente', `${order.reference} requiere validación administrativa.`, [admin.name], 'Alta', order.id, 'Aprobar');
    const creatorNotification = createNotification('Solicitud enviada', `Tu pedido ${order.reference} fue registrado y está pendiente de aprobación.`, [activeEmployee.name], 'Media', order.id, 'Ver flujo');
    const savedClient = { reference: order.reference, clientEmail: draft.clientEmail, clientName: draft.clientName, furnitureName: draft.furnitureName };
    mutate(
      (current) => ({ ...current, orders: [order, ...current.orders], notifications: [creatorNotification, adminNotification, ...current.notifications] }),
      `Solicitud ${order.reference} creada y enviada a administración.`,
      creatorNotification,
      {
        action: 'create_order',
        detail: `Se registro la solicitud ${order.reference} y se envio a aprobacion.`,
        entityId: order.id,
        entityType: 'order',
        orderId: order.id,
        mailItem: {
          recipient: draft.clientEmail,
          subject: `Confirmación de pedido ${order.reference} · TallerFlow`,
          body: `Hola ${draft.clientName},\n\nSu solicitud de mueble "${draft.furnitureName}" ha sido registrada exitosamente con la referencia ${order.reference}.\n\nDetalles del pedido:\n- Material: ${draft.material}\n- Tamaño: ${draft.size}\n- Costo estimado: ${formatCurrency(Number(draft.estimatedCost) || 0)}\n- Entrega objetivo: ${formatDateOnly(draft.dueDate)}\n${draft.needsCushions ? '- Incluye almohadas\n' : ''}${draft.notes ? `- Notas: ${draft.notes}\n` : ''}\nLe notificaremos el avance de su pedido por este medio.\n\nGracias por confiar en TallerFlow Muebles.`,
          pdfRequested: true,
        },
      },
    );
    setSelectedOrderId(order.id);
    setDraft(freshDraft());
    setDraftStages([...STAGE_OPTIONS]);
    setShowAddStage(false);
    setLastCreatedOrder(savedClient);
    setShowSuccessModal(true);
  }

  function updatePricing(orderId: string, field: 'productionCost' | 'finalPrice', value: string) {
    updateOrder(orderId, (order) => updateMargins({ ...order, pricing: { ...order.pricing, [field]: clampNumber(value, order.pricing[field]) }, updatedAt: new Date().toISOString() }));
  }

  function updateAdminNote(orderId: string, note: string) {
    updateOrder(orderId, (order) => ({ ...order, pricing: { ...order.pricing, adminNote: note }, updatedAt: new Date().toISOString() }));
  }

  function assignStage(orderId: string, stageId: string, assigneeId: string) {
    updateOrder(orderId, (order) => ({ ...order, stages: order.stages.map((stage) => (stage.id === stageId ? { ...stage, assigneeId } : stage)), updatedAt: new Date().toISOString() }));
  }

  function markStagePaid(orderId: string, stageId: string) {
    if (activeRole !== 'administracion') return;
    updateOrder(orderId, (order) => ({
      ...order,
      stages: order.stages.map((stage) =>
        stage.id === stageId ? { ...stage, paidAt: new Date().toISOString() } : stage,
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function updateStagePayout(orderId: string, stageId: string, value: string) {
    updateOrder(orderId, (order) => ({ ...order, stages: order.stages.map((stage) => (stage.id === stageId ? { ...stage, payout: clampNumber(value, stage.payout) } : stage)), updatedAt: new Date().toISOString() }));
  }

  function updateStageRule(orderId: string, stageId: string, payoutRule: PayoutRule) {
    updateOrder(orderId, (order) => ({ ...order, stages: order.stages.map((stage) => (stage.id === stageId ? { ...stage, payoutRule } : stage)), updatedAt: new Date().toISOString() }));
  }

  function moveStage(orderId: string, stageId: string, direction: -1 | 1) {
    if (activeRole !== 'administracion') return;
    updateOrder(orderId, (order) => {
      const stages = [...order.stages];
      const index = stages.findIndex((stage) => stage.id === stageId);
      const target = index + direction;
      if (index <= 1 || target <= 1 || target >= stages.length) return order;
      const current = stages[index];
      stages[index] = stages[target];
      stages[target] = current;
      return { ...order, stages, updatedAt: new Date().toISOString() };
    });
  }

  function approveOrder(orderId: string) {
    if (activeRole !== 'administracion') {
      setStatusMessage('Solo administración puede aprobar pedidos.');
      return;
    }
    let emitted: AppNotification | undefined;
    mutate((current) => ({
      ...current,
      orders: current.orders.map((order) => {
        if (order.id !== orderId) return order;
        const now = new Date().toISOString();
        const stages = order.stages.map((stage, index) => (index === 1 ? { ...stage, status: 'completed' as const, startedAt: stage.startedAt ?? now, completedAt: now } : stage));
        const nextStage = stages.find((stage, index) => stage.status === 'pending' && stages.slice(0, index).every((item) => item.status === 'completed'));
        const nextEmployee = nextStage && current.employees.find((employee) => employee.id === nextStage.assigneeId);
        emitted = nextStage && nextEmployee ? createNotification('Pedido liberado', `${order.reference} quedó listo para ${nextStage.title}.`, [nextEmployee.name], order.priority, order.id, 'Abrir flujo') : undefined;
        const approved = updateMargins({ ...order, stages, updatedAt: now, events: [...order.events, createOrderEvent(activeEmployee.id, 'Pedido aprobado', 'Administración liberó la producción.', 'admin')] });
        return { ...approved, status: deriveOrderStatus(approved) };
      }),
      notifications: emitted ? [emitted, ...current.notifications] : current.notifications,
    }), 'Pedido aprobado y flujo liberado.', emitted, {
      action: 'approve_order',
      detail: `Administracion aprobo y libero el pedido ${orderId}.`,
      entityId: orderId,
      entityType: 'order',
      orderId,
    });
    setActiveTab('flujo');
  }

  function startStage(orderId: string, stageId: string) {
    let emitted: AppNotification | undefined;
    let allowed = false;
    mutate((current) => ({
      ...current,
      orders: current.orders.map((order) => {
        if (order.id !== orderId) return order;
        const unlocked = getCurrentExecutableStage(order);
        const stage = order.stages.find((item) => item.id === stageId);
        if (!stage || !unlocked || unlocked.id !== stageId) return order;
        if (activeRole !== 'administracion' && stage.role !== activeRole) return order;
        allowed = true;
        const now = new Date().toISOString();
        const next = { ...order, stages: order.stages.map((item) => (item.id === stageId ? { ...item, status: 'active' as const, startedAt: now } : item)), updatedAt: now, events: [...order.events, createOrderEvent(activeEmployee.id, `Etapa iniciada: ${stage.title}`, `${activeEmployee.name} inició esta etapa.`, 'workflow')] };
        const admin = findEmployeeByRole(current.employees, 'administracion');
        emitted = createNotification('Etapa en curso', `${order.reference}: ${stage.title} acaba de iniciar.`, [admin.name], order.priority, order.id, 'Seguir');
        return { ...next, status: deriveOrderStatus(next) };
      }),
      notifications: emitted ? [emitted, ...current.notifications] : current.notifications,
    }), allowed ? 'Etapa iniciada.' : 'No puedes iniciar esta etapa.', emitted, allowed ? {
      action: 'start_stage',
      detail: `Se inicio la etapa ${stageId} del pedido ${orderId}.`,
      entityId: orderId,
      entityType: 'order',
      orderId,
    } : undefined);
  }

  function completeStage(orderId: string, stageId: string) {
    let emitted: AppNotification | undefined;
    let allowed = false;
    mutate((current) => ({
      ...current,
      orders: current.orders.map((order) => {
        if (order.id !== orderId) return order;
        const stage = order.stages.find((item) => item.id === stageId);
        if (!stage || stage.status === 'completed') return order;
        if (activeRole !== 'administracion' && stage.role !== activeRole) return order;
        allowed = true;
        const now = new Date().toISOString();
        const stages = order.stages.map((item) => (item.id === stageId ? { ...item, status: 'completed' as const, startedAt: item.startedAt ?? now, completedAt: now } : item));
        const nextStage = stages.find((item, index) => item.status === 'pending' && stages.slice(0, index).every((entry) => entry.status === 'completed'));
        const next = { ...order, stages, updatedAt: now, events: [...order.events, createOrderEvent(activeEmployee.id, `Etapa finalizada: ${stage.title}`, `${activeEmployee.name} finalizó esta etapa.`, 'workflow')] };
        if (nextStage) {
          const employee = current.employees.find((item) => item.id === nextStage.assigneeId);
          emitted = employee ? createNotification('Nueva etapa lista', `${order.reference}: puedes iniciar ${nextStage.title}.`, [employee.name], order.priority, order.id, 'Tomar etapa') : undefined;
        } else {
          emitted = createNotification('Pedido completado', `${order.reference} terminó el flujo completo.`, [findEmployeeByRole(current.employees, 'comercial').name], 'Alta', order.id, 'Enviar PDF');
        }
        return { ...next, status: deriveOrderStatus(next) };
      }),
      notifications: emitted ? [emitted, ...current.notifications] : current.notifications,
    }), allowed ? 'Etapa finalizada.' : 'No puedes finalizar esta etapa.', emitted, allowed ? {
      action: 'complete_stage',
      detail: `Se finalizo la etapa ${stageId} del pedido ${orderId}.`,
      entityId: orderId,
      entityType: 'order',
      orderId,
    } : undefined);
  }

  function markRead(notificationId: string) {
    mutate((current) => ({ ...current, notifications: current.notifications.map((item) => (item.id === notificationId ? { ...item, read: true } : item)) }));
  }

  function updateSetting(field: 'autoClientEmail' | 'highPriorityPush', value: boolean) {
    mutate((current) => ({ ...current, notificationSettings: { ...current.notificationSettings, [field]: value } }));
  }

  function updateEmployeePaymentMethods(employeeId: string, methods: string[]) {
    mutate((current) => ({
      ...current,
      employees: current.employees.map((emp) =>
        emp.id === employeeId ? { ...emp, paymentMethods: methods } : emp,
      ),
    }));
  }

  function updateEmployeePaymentAccount(employeeId: string, method: string, account: string) {
    mutate((current) => ({
      ...current,
      employees: current.employees.map((emp) =>
        emp.id === employeeId ? { ...emp, paymentAccounts: { ...(emp.paymentAccounts ?? {}), [method]: account } } : emp,
      ),
    }));
  }

  function updateOrderPriority(orderId: string, priority: Priority) {
    mutate((current) => ({ ...current, orders: current.orders.map((o) => (o.id === orderId ? { ...o, priority } : o)) }));
  }

  async function handlePdf(order: FurnitureOrder, share = false, email = false) {
    setPdfBusyOrderId(order.id);
    try {
      const uri = await createOrderPdf(order, workspace.employees);
      if (share) await sharePdf(uri);
      if (email) await composeOrderEmail(order, uri);
      const notification = createNotification('Documento generado', `PDF listo para ${order.reference}.`, [order.client.name], 'Media', order.id, 'Cliente');
      mutate(
        (current) => ({ ...current, notifications: [notification, ...current.notifications] }),
        email ? 'PDF generado y correo preparado.' : share ? 'PDF generado y compartido.' : 'PDF generado.',
        undefined,
        {
          action: email ? 'prepare_client_email' : 'generate_pdf',
          detail: email ? `Se preparo correo para ${order.reference}.` : `Se genero PDF para ${order.reference}.`,
          entityId: email ? notification.id : order.id,
          entityType: email ? 'mailQueue' : 'order',
          orderId: order.id,
          mailItem: email
            ? {
                recipient: order.client.email,
                subject: `Seguimiento ${order.reference}`,
                body: `Resumen del pedido ${order.reference} listo para el cliente.`,
                pdfRequested: true,
              }
            : undefined,
        },
      );
    } finally {
      setPdfBusyOrderId(null);
    }
  }

  async function forceSyncNow() {
    setSyncing(true);
    try {
      const result = await persistWorkspace(stamp(workspace));
      setWorkspace(result.workspace);
      setSyncMode(result.mode);
      setStatusMessage(
        result.mode === 'firebase'
          ? 'Sincronizacion forzada completada con Firebase.'
          : 'Sincronizacion local completada. Falta conectar Firebase real.',
      );
    } finally {
      setSyncing(false);
    }
  }

  function processMailQueue() {
    const pendingItems = workspace.mailQueue.filter((item) => item.status !== 'sent');

    if (!pendingItems.length) {
      setStatusMessage('No hay correos pendientes en la cola.');
      return;
    }

    mutate(
      (current) => ({
        ...current,
        mailQueue: current.mailQueue.map((item) =>
          item.status === 'sent'
            ? item
            : {
                ...item,
                status: 'sent',
              }
        ),
      }),
      'Cola de correo procesada localmente.',
      undefined,
      {
        action: 'process_mail_queue',
        detail: `Se procesaron ${pendingItems.length} correos preparados.`,
        entityId: pendingItems[0].id,
        entityType: 'mailQueue',
        orderId: pendingItems[0].orderId,
      },
    );
  }

  if (loading) {
    return (
      <ThemeContext.Provider value={{ theme, styles }}>
        <SafeAreaView style={styles.center}>
          <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
          <ActivityIndicator size="large" color={theme.teal} />
          <Text style={styles.muted}>Cargando la operación del taller...</Text>
        </SafeAreaView>
      </ThemeContext.Provider>
    );
  }

  if (!session) {
    return (
      <ThemeContext.Provider value={{ theme, styles }}>
        <SafeAreaView style={styles.safe}>
          <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
          <LinearGradient colors={[theme.backgroundTop, theme.backgroundMid, theme.backgroundBottom]} style={styles.fill}>
          <BackgroundGlow />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
            <ScrollView contentContainerStyle={styles.authPage}>
              <View style={styles.hero}>
                <Text style={styles.title}>Taller Flow</Text>
              </View>

              <BlurView intensity={38} tint={themeMode === 'dark' ? 'dark' : 'light'} style={styles.authPanel}>
                <Field label="Correo corporativo">
                  <TextInput
                    value={loginEmail}
                    onChangeText={setLoginEmail}
                    style={styles.input}
                    placeholder="usuario@tallerflow.co"
                    placeholderTextColor={theme.slate}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </Field>
                <Field label="Clave demo">
                  <TextInput
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                    style={styles.input}
                    placeholder="Clave de prueba"
                    placeholderTextColor={theme.slate}
                    secureTextEntry
                  />
                </Field>
                <View style={styles.row}>
                  <Tag label={`Clave: ${DEMO_PASSWORD}`} />
                  <Tag label={`${workspace.employees.length} perfiles disponibles`} />
                </View>
                <View style={styles.sessionCard}>
                  <View style={styles.sessionHeader}>
                    <View>
                      <Text style={styles.cardTitle}>Apariencia</Text>
                      <Text style={styles.muted}>{themeMode === 'dark' ? 'Modo oscuro glass' : 'Modo claro glass'}</Text>
                    </View>
                    <Switch
                      value={themeMode === 'dark'}
                      onValueChange={toggleThemeMode}
                      thumbColor={themeMode === 'dark' ? theme.teal : '#dce7ff'}
                      trackColor={{ false: theme.statusTrack, true: theme.tealSoft }}
                    />
                  </View>
                </View>
                <Text style={loginError ? styles.errorText : styles.small}>
                  {loginError || 'Usa cualquier correo del equipo y la clave demo para entrar.'}
                </Text>
                <Pressable onPress={() => { void submitLogin(); }} style={styles.primaryButton} disabled={authBusy}>
                  <Text style={styles.primaryButtonText}>{authBusy ? 'Entrando...' : 'Entrar al sistema'}</Text>
                </Pressable>
              </BlurView>

              <Panel title="Perfiles de prueba" subtitle="Accede rapido a cada rol para validar la operacion punta a punta.">
                {workspace.employees.map((employee) => (
                  <View key={employee.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{employee.name}</Text>
                    <Text style={styles.muted}>{getRoleLabel(employee.role)} · {employee.email}</Text>
                    <View style={styles.row}>
                      <Tag label={employee.availability} />
                      <Tag label={`${employee.performance}% desempeno`} />
                    </View>
                    <View style={styles.row}>
                      <Quick
                        label="Cargar correo"
                        onPress={() => {
                          setLoginEmail(employee.email);
                          setLoginPassword(DEMO_PASSWORD);
                          setLoginError('');
                        }}
                      />
                      <Pressable onPress={() => { void signInWithEmployee(employee); }} style={styles.primaryMini} disabled={authBusy}>
                        <Text style={styles.primaryMiniText}>Entrar como {getRoleLabel(employee.role)}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </Panel>
            </ScrollView>
          </KeyboardAvoidingView>
        </LinearGradient>
      </SafeAreaView>
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, styles }}>
      <SafeAreaView style={styles.safe}>
        <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
        <LinearGradient colors={[theme.backgroundTop, theme.backgroundMid, theme.backgroundBottom]} style={styles.fill}>
          <BackgroundGlow />
          <ScrollView contentContainerStyle={styles.page}>
          {(activeTab === 'dashboard' || activeTab === 'clientes') && selectedOrder ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.row}>
                {visibleOrders.map((order) => (
                  <Chip key={order.id} label={`${order.reference} · ${order.client.name}`} active={selectedOrder.id === order.id} onPress={() => setSelectedOrderId(order.id)} />
                ))}
              </View>
            </ScrollView>
          ) : null}

          {activeTab === 'home' ? (
            <View style={{ gap: 16 }}>
              {/* Hero de bienvenida */}
              <LinearGradient colors={[theme.teal + '22', theme.glassStrong]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: 20, marginBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <LinearGradient colors={[theme.teal, '#77ffd1']} style={{ width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#0a1628', fontSize: 22, fontWeight: '900' }}>{activeEmployee.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}</Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.ink, fontSize: 18, fontWeight: '800' }}>Hola, {activeEmployee.name.split(' ')[0]} 👋</Text>
                  <Text style={{ color: theme.teal, fontSize: 12, fontWeight: '600', marginTop: 2 }}>{getRoleLabel(activeRole)}</Text>
                  {unreadCount > 0 ? <Text style={{ color: '#f59e0b', fontSize: 11, marginTop: 4 }}>🔔 {unreadCount} alerta{unreadCount > 1 ? 's' : ''} sin leer</Text> : <Text style={{ color: '#22c55e', fontSize: 11, marginTop: 4 }}>✓ Todo al día</Text>}
                </View>
              </LinearGradient>

              {/* Métricas rápidas */}
              <View style={styles.row}>
                <Stat label="Pedidos" value={`${visibleOrders.length}`} />
                {activeRole === 'administracion' ? (
                  <Stat label="Pagos pend." value={`${pendingPayouts.length}`} />
                ) : (
                  <Stat label="Activas" value={`${openAssignments.length}`} />
                )}
                <Stat label="Alertas" value={`${unreadCount}`} />
                <Stat label="Urgentes" value={`${metrics.urgent}`} />
              </View>

              {/* Acciones rápidas por rol */}
              <Panel title="Acciones rápidas" subtitle="">
                {activeRole === 'comercial' ? (
                  <View style={{ gap: 10 }}>
                    <Pressable onPress={() => setActiveTab('solicitudes')} style={[styles.primaryButton, { flexDirection: 'row', gap: 8, justifyContent: 'center' }]}>
                      <Ionicons name="add-circle" size={18} color={theme.buttonText} />
                      <Text style={styles.primaryButtonText}>Nueva solicitud</Text>
                    </Pressable>
                    <Pressable onPress={() => setActiveTab('flujo')} style={[styles.modalCancelButton, { flexDirection: 'row', gap: 8, justifyContent: 'center' }]}>
                      <Ionicons name="list" size={16} color={theme.ink} />
                      <Text style={styles.modalCancelText}>Ver mis pedidos</Text>
                    </Pressable>
                  </View>
                ) : activeRole === 'administracion' ? (
                  <View style={{ gap: 10 }}>
                    <Pressable onPress={() => setActiveTab('flujo')} style={[styles.primaryButton, { flexDirection: 'row', gap: 8, justifyContent: 'center' }]}>
                      <Ionicons name="play-circle" size={18} color={theme.buttonText} />
                      <Text style={styles.primaryButtonText}>Ver tareas del taller</Text>
                    </Pressable>
                    <Pressable onPress={() => setActiveTab('solicitudes')} style={[styles.modalCancelButton, { flexDirection: 'row', gap: 8, justifyContent: 'center' }]}>
                      <Ionicons name="document-text" size={16} color={theme.ink} />
                      <Text style={styles.modalCancelText}>Crear solicitud</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    <Pressable onPress={() => setActiveTab('flujo')} style={[styles.primaryButton, { flexDirection: 'row', gap: 8, justifyContent: 'center' }]}>
                      <Ionicons name="play-circle" size={18} color={theme.buttonText} />
                      <Text style={styles.primaryButtonText}>Ver mis tareas</Text>
                    </Pressable>
                  </View>
                )}
              </Panel>

              {/* Pedidos recientes */}
              {visibleOrders.length > 0 ? (
                <Panel title="Pedidos recientes" subtitle="">
                  {visibleOrders.slice(0, 4).map((order) => {
                    const progress = getOrderProgress(order);
                    const priorityColor = order.priority === 'Alta' ? '#ef4444' : order.priority === 'Media' ? '#f59e0b' : '#22c55e';
                    return (
                      <Pressable key={order.id} onPress={() => { setExpandedFlowOrderId(order.id); setActiveTab('flujo'); }} style={styles.card}>
                        <View style={styles.flowHeader}>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={styles.cardTitle}>{order.reference} · {order.furnitureName}</Text>
                            <Text style={styles.muted}>{order.client.name} · {getOrderStatusLabel(order.status)}</Text>
                          </View>
                          <View style={{ alignItems: 'center', gap: 3 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: priorityColor }} />
                              <Text style={styles.statValue}>{progress}%</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={14} color={theme.slate} />
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </Panel>
              ) : (
                <Panel title="Sin pedidos aún" subtitle="Los pedidos aparecerán aquí una vez creados.">
                  <></>
                </Panel>
              )}

              {/* Alertas recientes */}
              {unreadCount > 0 ? (
                <Panel title={`${unreadCount} alerta${unreadCount > 1 ? 's' : ''} pendiente${unreadCount > 1 ? 's' : ''}`} subtitle="">
                  {visibleNotifications.filter((n) => !n.read).slice(0, 3).map((notification) => {
                    const priorityColor = notification.priority === 'Alta' ? '#ef4444' : notification.priority === 'Media' ? '#f59e0b' : '#22c55e';
                    return (
                      <Pressable key={notification.id} onPress={() => { markRead(notification.id); setActiveTab('notificaciones'); }} style={styles.notifCard}>
                        <View style={[styles.notifDot, { backgroundColor: priorityColor }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.stepTitle}>{notification.title}</Text>
                          <Text style={styles.muted}>{notification.body}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                  <Pressable onPress={() => setActiveTab('notificaciones')} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                    <Text style={{ color: theme.teal, fontSize: 12, fontWeight: '700' }}>Ver todas →</Text>
                  </Pressable>
                </Panel>
              ) : null}
            </View>
          ) : null}

          {activeTab === 'dashboard' ? (
            <Panel title="Historial operativo" subtitle={activeRole === 'administracion' ? 'Eventos del taller, trazabilidad y pagos por liberar.' : 'Tus movimientos recientes, tareas activas y trazabilidad del pedido.'}>
              <View style={styles.row}>
                <Stat label={activeRole === 'administracion' ? 'Pagos' : 'Activas'} value={`${activeRole === 'administracion' ? pendingPayouts.length : openAssignments.length}`} />
                <Stat label="Terminadas" value={`${completedAssignments.length}`} />
                <Stat label="Alertas" value={`${unreadCount}`} />
                <Stat label="Pedidos" value={`${visibleOrders.length}`} />
              </View>
              <View style={styles.row}>
                {activeRole === 'administracion' ? <Quick label="Pagos pendientes" onPress={() => setActiveTab('administracion')} /> : <Quick label="Ir a tareas" onPress={() => setActiveTab('flujo')} />}
                <Quick label="Ver alertas" onPress={() => setActiveTab('notificaciones')} />
              </View>
              {activeRole === 'administracion' ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Pagos pendientes por liberar</Text>
                  <Text style={styles.muted}>{pendingPayouts.length} pagos listos · Total {formatCurrency(pendingPayoutTotal)}</Text>
                  {pendingPayouts.slice(0, 5).map(({ order, stage, employee }) => (
                    <Text key={`${order.id}-${stage.id}`} style={styles.small}>
                      {order.reference} · {stage.title} · {employee?.name ?? 'Sin responsable'} · {formatCurrency(stage.payout)}
                    </Text>
                  ))}
                </View>
              ) : null}
              {historyFeed.length ? historyFeed.slice(0, 8).map(({ order, event }) => (
                <View key={event.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{event.title}</Text>
                  <Text style={styles.muted}>{order.reference} · {order.client.name}</Text>
                  <Text style={styles.small}>{event.body}</Text>
                  <Text style={styles.small}>{formatDate(event.createdAt)}</Text>
                </View>
              )) : (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Sin historial reciente</Text>
                  <Text style={styles.muted}>Todavia no hay movimientos registrados para este panel.</Text>
                </View>
              )}
            </Panel>
          ) : null}

          {activeTab === 'solicitudes' ? (
            <Panel title="Crear solicitud" subtitle="Cliente, costo, material, tamaño y almohadas.">
              <View style={styles.grid}>
                <Field label="Cliente"><TextInput value={draft.clientName} onChangeText={(value) => updateDraft('clientName', value)} style={styles.input} /></Field>
                <Field label="Correo"><TextInput value={draft.clientEmail} onChangeText={(value) => updateDraft('clientEmail', value)} style={styles.input} /></Field>
                <Field label="Teléfono"><TextInput value={draft.clientPhone} onChangeText={(value) => updateDraft('clientPhone', value)} style={styles.input} /></Field>
                <Field label="Ciudad"><TextInput value={draft.clientCity} onChangeText={(value) => updateDraft('clientCity', value)} style={styles.input} /></Field>
                <Field label="Mueble"><TextInput value={draft.furnitureName} onChangeText={(value) => updateDraft('furnitureName', value)} style={styles.input} /></Field>
                <Field label="Material">
                  <StyledPicker selectedValue={draft.material} onValueChange={(value) => updateDraft('material', value)}>{MATERIALS.map((material) => <Picker.Item key={material} label={material} value={material} />)}</StyledPicker>
                </Field>
                <Field label="Tamaño"><TextInput value={draft.size} onChangeText={(value) => updateDraft('size', value)} style={styles.input} placeholder="2.00m x 0.90m x 0.85m" /></Field>
                <Field label="Costo estimado"><TextInput value={draft.estimatedCost} onChangeText={(value) => updateDraft('estimatedCost', value.replace(/[^\d]/g, ''))} style={styles.input} keyboardType="numeric" /></Field>
                <Field label="Entrega objetivo"><TextInput value={draft.dueDate} onChangeText={(value) => updateDraft('dueDate', value)} style={styles.input} /></Field>
              </View>
              <View style={styles.space}>
                <View><Text style={styles.label}>¿Incluye almohadas?</Text><Text style={styles.small}>Se refleja en flujo y PDF.</Text></View>
                <Switch value={draft.needsCushions} onValueChange={(value) => updateDraft('needsCushions', value)} />
              </View>
              <Field label="Notas"><TextInput value={draft.notes} onChangeText={(value) => updateDraft('notes', value)} style={[styles.input, styles.multiline]} multiline /></Field>
              <View style={styles.row}>
                <Tag label={draft.material} />
                <Tag label={draft.needsCushions ? 'Con almohadas' : 'Sin almohadas'} />
                <Tag label={draft.size || 'Sin tamaño'} />
              </View>

              {/* ── Flujo de trabajo ── */}
              <View style={[styles.card, { gap: 10 }]}>
                <Text style={styles.cardTitle}>Flujo de trabajo</Text>
                <Text style={styles.muted}>Elige una plantilla o arma el flujo manualmente.</Text>
                <View style={styles.row}>
                  {FLOW_TEMPLATES.map((tpl) => (
                    <Pressable key={tpl.label} onPress={() => { setDraftStages([...tpl.stages]); setShowAddStage(false); }} style={styles.chipPress}>
                      <LinearGradient colors={[theme.glassStrong, 'rgba(255,255,255,0.04)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.chip}>
                        <Text style={styles.chipText}>{tpl.label}</Text>
                      </LinearGradient>
                    </Pressable>
                  ))}
                </View>

                {draftStages.length === 0
                  ? <Text style={[styles.small, { textAlign: 'center', paddingVertical: 8 }]}>Sin etapas — agrega con el botón +</Text>
                  : draftStages.map((stage, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.glassStrong, borderRadius: 10, padding: 10 }}>
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: theme.teal, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#0a1628', fontSize: 11, fontWeight: '900' }}>{idx + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.stepTitle}>{stage.title}</Text>
                        <Text style={styles.small}>{getRoleLabel(stage.role)} · {formatCurrency(stage.payout)}</Text>
                      </View>
                      <Pressable onPress={() => setDraftStages((prev) => prev.filter((_, i) => i !== idx))}>
                        <Ionicons name="close-circle" size={20} color={theme.slate} />
                      </Pressable>
                    </View>
                  ))
                }

                {showAddStage ? (
                  <View style={{ gap: 6 }}>
                    {STAGE_OPTIONS.filter((opt) => !draftStages.some((s) => s.role === opt.role)).map((opt) => (
                      <Pressable key={opt.role} onPress={() => { setDraftStages((prev) => [...prev, opt]); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.glassStrong, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: theme.teal + '44' }}>
                        <Ionicons name="add-circle" size={18} color={theme.teal} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.stepTitle}>{opt.title}</Text>
                          <Text style={styles.small}>{getRoleLabel(opt.role)} · {formatCurrency(opt.payout)}</Text>
                        </View>
                      </Pressable>
                    ))}
                    {STAGE_OPTIONS.every((opt) => draftStages.some((s) => s.role === opt.role))
                      ? <Text style={[styles.small, { textAlign: 'center' }]}>Todas las etapas ya están en el flujo.</Text>
                      : null}
                    <Pressable onPress={() => setShowAddStage(false)} style={styles.modalCancelButton}>
                      <Text style={styles.modalCancelText}>Cerrar</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={() => setShowAddStage(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.teal + '66', backgroundColor: theme.glassStrong }}>
                    <Ionicons name="add-circle-outline" size={18} color={theme.teal} />
                    <Text style={[styles.chipText, { color: theme.teal }]}>Agregar etapa</Text>
                  </Pressable>
                )}
              </View>
              <Pressable onPress={() => {
                if (!draft.clientName || !draft.clientEmail || !draft.furnitureName || !draft.size || !draft.estimatedCost) {
                  setStatusMessage('Completa cliente, mueble, tamaño y costo.');
                  return;
                }
                setShowConfirmModal(true);
              }} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Enviar solicitud a administración</Text></Pressable>

              <Modal visible={showConfirmModal} transparent animationType="fade" onRequestClose={() => setShowConfirmModal(false)}>
                <View style={styles.modalOverlay}>
                  <View style={[styles.modalContent, { backgroundColor: theme.paper }]}>
                    <Text style={styles.cardTitle}>Confirmar solicitud</Text>
                    <Text style={styles.muted}>¿Estás seguro de enviar esta solicitud a administración?</Text>
                    <View style={styles.card}>
                      <Text style={styles.cardTitle}>{draft.furnitureName || 'Mueble'}</Text>
                      <Text style={styles.muted}>Cliente: {draft.clientName}</Text>
                      <Text style={styles.muted}>Correo: {draft.clientEmail}</Text>
                      <Text style={styles.muted}>Material: {draft.material}</Text>
                      <Text style={styles.muted}>Tamaño: {draft.size}</Text>
                      <Text style={styles.muted}>Costo estimado: {formatCurrency(Number(draft.estimatedCost) || 0)}</Text>
                      {draft.needsCushions ? <Tag label="Con almohadas" /> : null}
                      {draft.notes ? <Text style={styles.small}>Notas: {draft.notes}</Text> : null}
                    </View>
                    <View style={styles.row}>
                      <Pressable onPress={() => setShowConfirmModal(false)} style={styles.modalCancelButton}>
                        <Text style={styles.modalCancelText}>Cancelar</Text>
                      </Pressable>
                      <Pressable onPress={() => { setShowConfirmModal(false); createOrder(); }} style={styles.primaryButton}>
                        <Text style={styles.primaryButtonText}>Confirmar y enviar</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </Modal>

              <Modal visible={showSuccessModal} transparent animationType="slide" onRequestClose={() => { setShowSuccessModal(false); setActiveTab('flujo'); }}>
                <View style={styles.modalOverlay}>
                  <View style={[styles.successModal, { backgroundColor: theme.paper }]}>
                    <View style={styles.successCheck}>
                      <Ionicons name="checkmark" size={44} color="#fff" />
                    </View>
                    <Text style={styles.successTitle}>¡Solicitud registrada!</Text>
                    {lastCreatedOrder ? (
                      <>
                        <View style={styles.successRefBadge}>
                          <Text style={styles.successRefText}>{lastCreatedOrder.reference}</Text>
                        </View>
                        <Text style={styles.successFurniture}>{lastCreatedOrder.furnitureName}</Text>
                        <View style={styles.successDivider} />
                        <View style={styles.successEmailRow}>
                          <Ionicons name="mail-outline" size={18} color={theme.teal} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.muted}>Correo de confirmación enviado a:</Text>
                            <Text style={styles.successEmail}>{lastCreatedOrder.clientEmail}</Text>
                          </View>
                        </View>
                        <Text style={styles.small}>El cliente recibirá los detalles del pedido y seguimiento por correo electrónico.</Text>
                      </>
                    ) : null}
                    <Pressable onPress={() => { setShowSuccessModal(false); setActiveTab('flujo'); }} style={[styles.primaryButton, { marginTop: 6, width: '100%' }]}>
                      <Text style={styles.primaryButtonText}>Ver flujo del pedido</Text>
                    </Pressable>
                    <Pressable onPress={() => { setShowSuccessModal(false); setDraft(freshDraft()); }} style={[styles.modalCancelButton, { width: '100%' }]}>
                      <Text style={styles.modalCancelText}>Crear otra solicitud</Text>
                    </Pressable>
                  </View>
                </View>
              </Modal>
            </Panel>
          ) : null}

          {activeTab === 'administracion' ? (
            <Panel title="Pagos" subtitle="">
              <Text style={styles.muted}>Esta sección fue consolidada en Tareas. Abre un pedido desde Tareas para asignar responsables y definir pagos.</Text>
            </Panel>
          ) : null}

          {activeTab === 'flujo' ? (
            <Panel title="Tareas" subtitle={activeRole === 'administracion' ? 'Pedidos del taller. Toca uno para ver el flujo.' : 'Tus tareas activas y pendientes. Toca una para ver detalles.'}>
              {myActiveOrders.length ? myActiveOrders.map((order) => {
                const isExpanded = expandedFlowOrderId === order.id;
                const progress = getOrderProgress(order);
                const activeStageObj = getActiveStage(order);
                const curActiveEmp = activeStageObj ? workspace.employees.find((e) => e.id === activeStageObj.assigneeId) : null;
                return (
                  <View key={order.id}>
                    <Pressable onPress={() => setExpandedFlowOrderId(isExpanded ? null : order.id)} style={[styles.card, isExpanded && styles.flowItemActive]}>
                      <View style={styles.flowHeader}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={styles.cardTitle}>{order.reference} · {order.client.name}</Text>
                          <Text style={styles.muted}>{order.furnitureName} · {getOrderStatusLabel(order.status)}</Text>
                          {activeStageObj ? <Text style={styles.small}>{activeStageObj.title} · {curActiveEmp?.name ?? 'Sin responsable'}</Text> : null}
                        </View>
                        <View style={{ alignItems: 'center', gap: 2 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: order.priority === 'Alta' ? '#ef4444' : order.priority === 'Media' ? '#f59e0b' : '#22c55e' }} />
                            <Text style={styles.statValue}>{progress}%</Text>
                          </View>
                          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.slate} />
                        </View>
                      </View>
                    </Pressable>
                    {isExpanded ? (
                      <View style={[styles.flowColumn, { marginTop: 4 }]}>
                        {activeRole === 'administracion' ? (
                          <View style={[styles.card, { marginBottom: 8 }]}>
                            <View style={styles.row}>
                              <Field label="Urgencia">
                                <StyledPicker selectedValue={order.priority} onValueChange={(value) => updateOrderPriority(order.id, value as Priority)}>
                                    <Picker.Item label="Alta" value="Alta" />
                                    <Picker.Item label="Media" value="Media" />
                                    <Picker.Item label="Baja" value="Baja" />
                                  </StyledPicker>
                              </Field>
                              {order.status === 'pending_approval' ? (
                                <Pressable onPress={() => approveOrder(order.id)} style={[styles.primaryMini, { alignSelf: 'flex-end', marginBottom: 4 }]}>
                                  <Text style={styles.primaryMiniText}>Aprobar pedido</Text>
                                </Pressable>
                              ) : null}
                            </View>
                          </View>
                        ) : null}
                        {order.stages.map((stage, index) => {
                          const unlocked = getCurrentExecutableStage(order);
                          const currentActive = getActiveStage(order);
                          const canOperate = activeRole === 'administracion' || (stage.role === activeRole && (stage.status === 'active' || unlocked?.id === stage.id));
                          const employee = workspace.employees.find((item) => item.id === stage.assigneeId);
                          const hasOrderNow = currentActive?.id === stage.id || (!currentActive && unlocked?.id === stage.id);
                          const isNext = !hasOrderNow && unlocked?.id === stage.id;
                          const canMarkPaid = activeRole === 'administracion' && progress === 100 && stage.status === 'completed' && stage.payout > 0 && !stage.paidAt;
                          return (
                            <View key={stage.id} style={[styles.flowItem, hasOrderNow && styles.flowItemActive]}>
                              <View style={styles.flowRail}>
                                <AvatarNode name={employee?.name ?? 'SR'} uri={employee?.avatarUri} status={stage.status} isMe={stage.assigneeId === activeEmployee.id} />
                                {index < order.stages.length - 1 ? <View style={[styles.flowConnector, hasOrderNow && styles.flowConnectorActive]} /> : null}
                              </View>
                              <View style={styles.flowBody}>
                                <View style={styles.flowHeader}>
                                  <Text style={styles.stepTitle}>{stage.title}</Text>
                                  <Tag label={getStageStatusLabel(stage.status)} />
                                </View>
                                <Text style={styles.muted}>{employee?.name ?? 'Sin responsable'} · {getRoleLabel(stage.role)}</Text>
                                {hasOrderNow ? <Text style={styles.flowOwnerText}>Este usuario tiene el pedido ahora.</Text> : null}
                                {isNext ? <Text style={styles.flowNextText}>Siguiente responsable en cola.</Text> : null}
                                {activeRole === 'administracion' ? (
                                  <View style={{ gap: 6, marginTop: 4 }}>
                                    <Field label="Responsable">
                                      <StyledPicker selectedValue={stage.assigneeId} onValueChange={(value) => assignStage(order.id, stage.id, value)}>
                                          {workspace.employees.filter((emp) => emp.role === stage.role).map((emp) => <Picker.Item key={emp.id} label={emp.name} value={emp.id} />)}
                                        </StyledPicker>
                                    </Field>
                                    <View style={styles.row}>
                                      <Field label="Pago"><TextInput value={`${stage.payout}`} onChangeText={(value) => updateStagePayout(order.id, stage.id, value)} style={styles.input} keyboardType="numeric" /></Field>
                                      <Field label="Cuándo paga">
                                        <StyledPicker selectedValue={stage.payoutRule} onValueChange={(value) => updateStageRule(order.id, stage.id, value as PayoutRule)}>
                                            {PAY_RULES.map((rule) => <Picker.Item key={rule} label={rule} value={rule} />)}
                                          </StyledPicker>
                                      </Field>
                                    </View>
                                  </View>
                                ) : (
                                  stage.assigneeId === activeEmployee.id && stage.payout > 0 ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                      <Text style={[styles.small, { color: theme.teal, fontWeight: '700' }]}>Mi pago · {formatCurrency(stage.payout)} · {stage.payoutRule}</Text>
                                      {stage.status === 'completed' ? (
                                        stage.paidAt
                                          ? <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: '#22c55e55' }}>
                                              <Text style={{ color: '#22c55e', fontSize: 10, fontWeight: '800' }}>✓ Pagado</Text>
                                            </View>
                                          : <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(251,191,36,0.15)', borderWidth: 1, borderColor: '#fbbf2455' }}>
                                              <Text style={{ color: '#fbbf24', fontSize: 10, fontWeight: '800' }}>Por pagar</Text>
                                            </View>
                                      ) : null}
                                    </View>
                                  ) : null
                                )}
                                <View style={styles.row}>
                                  {canOperate && stage.status === 'pending' ? <Pressable onPress={() => startStage(order.id, stage.id)} style={styles.primaryMini}><Text style={styles.primaryMiniText}>Iniciar tarea</Text></Pressable> : null}
                                  {canOperate && stage.status === 'active' ? <Pressable onPress={() => completeStage(order.id, stage.id)} style={styles.primaryMini}><Text style={styles.primaryMiniText}>Finalizar tarea</Text></Pressable> : null}
                                  {canMarkPaid ? (
                                    <Pressable onPress={() => markStagePaid(order.id, stage.id)} style={[styles.primaryMini, { backgroundColor: '#22c55e' }]}>
                                      <Text style={styles.primaryMiniText}>💸 Marcar pagado</Text>
                                    </Pressable>
                                  ) : null}
                                  {stage.paidAt ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: '#22c55e55' }}>
                                      <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '800' }}>✓ Pagado</Text>
                                      <Text style={{ color: theme.slate, fontSize: 10 }}>{formatDate(stage.paidAt)}</Text>
                                    </View>
                                  ) : null}
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              }) : <Text style={styles.muted}>No tienes tareas activas en este momento.</Text>}
            </Panel>
          ) : null}

          {activeTab === 'historial' ? (
            <Panel title="Historial" subtitle={activeRole === 'administracion' ? 'Todos los pedidos con etapas completadas.' : 'Tus tareas terminadas. Toca un pedido para ver el detalle.'}>              {myCompletedOrders.length ? myCompletedOrders.map((order) => {
                const isExpanded = expandedFlowOrderId === order.id;
                const progress = getOrderProgress(order);
                const activeStageObj = getActiveStage(order);
                const curStageEmp = activeStageObj ? workspace.employees.find((e) => e.id === activeStageObj.assigneeId) : null;
                const myStages = order.stages.filter((s) => s.assigneeId === activeEmployee.id && s.payout > 0 && s.status === 'completed');
                const hasUnpaid = myStages.some((s) => !s.paidAt);
                const allPaid   = myStages.length > 0 && myStages.every((s) => !!s.paidAt);
                return (
                  <View key={order.id}>
                    <Pressable
                      onPress={() => setExpandedFlowOrderId(isExpanded ? null : order.id)}
                      style={[
                        styles.card,
                        isExpanded && styles.flowItemActive,
                        hasUnpaid && { borderLeftWidth: 3, borderLeftColor: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.06)' },
                        allPaid   && { borderLeftWidth: 3, borderLeftColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.06)' },
                      ]}
                    >
                      <View style={styles.flowHeader}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={styles.cardTitle}>{order.reference} · {order.client.name}</Text>
                          <Text style={styles.muted}>{order.furnitureName} · {getOrderStatusLabel(order.status)}</Text>
                          {activeStageObj ? <Text style={styles.small}>{activeStageObj.title} · {curStageEmp?.name ?? 'Sin responsable'}</Text> : null}
                          {hasUnpaid
                            ? <Text style={{ color: '#fbbf24', fontSize: 10, fontWeight: '800', marginTop: 2 }}>⚠ Pago pendiente</Text>
                            : allPaid
                              ? <Text style={{ color: '#22c55e', fontSize: 10, fontWeight: '800', marginTop: 2 }}>✓ Pago recibido</Text>
                              : null}
                        </View>
                        <View style={{ alignItems: 'center', gap: 2 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: order.priority === 'Alta' ? '#ef4444' : order.priority === 'Media' ? '#f59e0b' : '#22c55e' }} />
                            <Text style={styles.statValue}>{progress}%</Text>
                          </View>
                          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.slate} />
                        </View>
                      </View>
                    </Pressable>
                    {isExpanded ? (
                      <View style={[styles.flowColumn, { marginTop: 4 }]}>
                        {order.stages.filter((stage) => activeRole === 'administracion' || stage.assigneeId === activeEmployee.id).map((stage, index, arr) => {
                          const employee = workspace.employees.find((item) => item.id === stage.assigneeId);
                          const isMyStage = stage.assigneeId === activeEmployee.id && stage.payout > 0;
                          const unpaid = isMyStage && stage.status === 'completed' && !stage.paidAt;
                          const paid   = isMyStage && stage.status === 'completed' && !!stage.paidAt;
                          return (
                            <View key={stage.id} style={[
                              styles.flowItem,
                              stage.status === 'completed' && styles.flowItemActive,
                              unpaid && { borderLeftWidth: 3, borderLeftColor: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.06)' },
                              paid   && { borderLeftWidth: 3, borderLeftColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.06)' },
                            ]}>
                              <View style={styles.flowRail}>
                                <AvatarNode name={employee?.name ?? 'SR'} uri={employee?.avatarUri} status={stage.status} isMe={stage.assigneeId === activeEmployee.id} />
                                {index < arr.length - 1 ? <View style={[styles.flowConnector, stage.status === 'completed' && styles.flowConnectorActive]} /> : null}
                              </View>
                              <View style={styles.flowBody}>
                                <View style={styles.flowHeader}>
                                  <Text style={styles.stepTitle}>{stage.title}</Text>
                                  <Tag label={getStageStatusLabel(stage.status)} />
                                </View>
                                <Text style={styles.muted}>{employee?.name ?? 'Sin responsable'} · {getRoleLabel(stage.role)}</Text>
                                {stage.assigneeId === activeEmployee.id && stage.payout > 0 ? (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                                    <Text style={[styles.small, { color: theme.teal, fontWeight: '700' }]}>Mi pago · {formatCurrency(stage.payout)} · {stage.payoutRule}</Text>
                                    {stage.paidAt
                                      ? <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: '#22c55e55' }}>
                                          <Text style={{ color: '#22c55e', fontSize: 10, fontWeight: '800' }}>✓ Pagado</Text>
                                        </View>
                                      : <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(251,191,36,0.15)', borderWidth: 1, borderColor: '#fbbf2455' }}>
                                          <Text style={{ color: '#fbbf24', fontSize: 10, fontWeight: '800' }}>Por pagar</Text>
                                        </View>
                                    }
                                  </View>
                                ) : null}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              }) : <Text style={styles.muted}>No hay historial de tareas completadas aún.</Text>}
            </Panel>
          ) : null}

          {activeTab === 'notificaciones' ? (
            <Panel title="Alertas" subtitle="Tus notificaciones recientes.">
              {filteredNotifications.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Todo al día</Text>
                  <Text style={styles.muted}>No tienes alertas pendientes por revisar.</Text>
                </View>
              ) : null}
              {filteredNotifications.map((notification) => {
                const relatedOrder = notification.orderId ? workspace.orders.find((o) => o.id === notification.orderId) : null;
                const progress = relatedOrder ? getOrderProgress(relatedOrder) : null;
                const priorityColor = notification.priority === 'Alta' ? '#ef4444' : notification.priority === 'Media' ? '#f59e0b' : '#22c55e';
                return (
                  <Pressable key={notification.id} onPress={() => { if (!notification.read) markRead(notification.id); if (relatedOrder) { setSelectedOrderId(relatedOrder.id); setExpandedFlowOrderId(relatedOrder.id); setActiveTab('flujo'); } }} style={[styles.notifCard, notification.read && styles.notifCardRead]}>
                    <View style={[styles.notifDot, { backgroundColor: priorityColor }]} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={styles.flowHeader}>
                        <Text style={notification.read ? styles.muted : styles.cardTitle}>{notification.title}</Text>
                        {!notification.read ? <View style={styles.notifBadge}><Text style={styles.notifBadgeText}>Nueva</Text></View> : null}
                      </View>
                      <Text style={styles.muted}>{notification.body}</Text>
                      {relatedOrder ? (
                        <View style={styles.row}>
                          <Tag label={relatedOrder.reference} />
                          <Tag label={relatedOrder.furnitureName} />
                          {progress !== null ? <Tag label={`${progress}% completado`} /> : null}
                        </View>
                      ) : null}
                      <Text style={styles.small}>{formatDate(notification.createdAt)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </Panel>
          ) : null}

          {activeTab === 'clientes' ? (
            <Panel title="PDF y correo" subtitle="Genera un resumen del pedido y compártelo con el cliente.">
              {selectedOrder ? (
                <>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>{selectedOrder.reference} · {selectedOrder.client.name}</Text>
                    <Text style={styles.muted}>{selectedOrder.client.email} · {selectedOrder.client.phone} · {selectedOrder.client.city}</Text>
                    <Text style={styles.small}>{selectedOrder.furnitureName} · {selectedOrder.material} · {selectedOrder.size}</Text>
                  </View>
                  <View style={styles.row}>
                    <Stat label="Precio final" value={formatCurrency(selectedOrder.pricing.finalPrice)} />
                    <Stat label="Margen" value={formatCurrency(selectedOrder.pricing.expectedMargin)} />
                    <Stat label="Progreso" value={`${getOrderProgress(selectedOrder)}%`} />
                  </View>
                  <View style={styles.row}>
                    <Pressable onPress={() => handlePdf(selectedOrder)} style={styles.primaryButton} disabled={pdfBusyOrderId === selectedOrder.id}><Text style={styles.primaryButtonText}>{pdfBusyOrderId === selectedOrder.id ? 'Generando...' : 'Generar PDF'}</Text></Pressable>
                    <Quick label="Compartir" onPress={() => handlePdf(selectedOrder, true)} />
                    <Quick label="Correo cliente" onPress={() => handlePdf(selectedOrder, false, true)} />
                  </View>
                  <Text style={styles.small}>En web se abre impresión o `mailto:`. Para correo automático real desde backend usa la configuración Firebase incluida.</Text>
                </>
              ) : <Text style={styles.muted}>Selecciona un pedido para generar documentos.</Text>}
            </Panel>
          ) : null}

          {activeTab === 'equipo' ? (
            <Panel title="Carga y desempeño" subtitle="Disponibilidad, especialidades y ganancia estimada por colaborador.">
              <TextInput value={teamQuery} onChangeText={(value) => startTransition(() => setTeamQuery(value))} style={styles.input} placeholder="Buscar por nombre o especialidad..." />
              {filteredEmployees.map((employee) => {
                const assigned = workspace.orders.flatMap((order) => order.stages.filter((stage) => stage.assigneeId === employee.id));
                const pending = assigned.filter((stage) => stage.status !== 'completed').length;
                const earnings = assigned.reduce((sum, stage) => sum + stage.payout, 0);
                return (
                  <View key={employee.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{employee.name} · {getRoleLabel(employee.role)}</Text>
                    <Text style={styles.muted}>{employee.availability} · {employee.specialties.join(' · ')}</Text>
                    <View style={styles.row}>
                      <Tag label={`Activas ${pending}`} />
                      <Tag label={`Ganancia ${formatCurrency(earnings)}`} />
                      <Tag label={`Desempeño ${employee.performance}%`} />
                    </View>
                  </View>
                );
              })}
            </Panel>
          ) : null}

          {activeTab === 'mas' ? (
            <Panel title="Centro avanzado" subtitle="Administracion, clientes, mejoras y procesos de backend.">
              <View style={styles.row}>
                <Quick label="Administracion" onPress={() => setActiveTab('administracion')} />
                <Quick label="Clientes" onPress={() => setActiveTab('clientes')} />
                <Quick label="Equipo" onPress={() => setActiveTab('equipo')} />
                <Quick label="250 mejoras" onPress={() => setActiveTab('mejoras')} />
              </View>
              <View style={styles.row}>
                <Stat label="Salud" value={systemHealth.syncStatus} />
                <Stat label="Sync jobs" value={`${systemHealth.queueDepth}`} />
                <Stat label="Emails" value={`${systemHealth.pendingEmails}`} />
                <Stat label="Audit" value={`${workspace.auditLog.length}`} />
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Sesion activa</Text>
                <Text style={styles.small}>Cambia de perfil para validar permisos y flujo por area.</Text>
                <View style={styles.row}>
                  {workspace.employees.map((employee) => (
                    <Chip
                      key={employee.id}
                      label={`${employee.name.split(' ')[0]} · ${getRoleLabel(employee.role)}`}
                      active={employee.id === activeEmployee.id}
                      onPress={() => { void signInWithEmployee(employee); }}
                    />
                  ))}
                </View>
                <View style={styles.row}>
                  <Quick label="Cerrar sesion" onPress={() => { void logout(); }} />
                </View>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Cola de sincronizacion</Text>
                {workspace.syncQueue.slice(0, 5).map((item) => (
                  <Text key={item.id} style={styles.small}>
                    {item.status} · {item.action} · {item.message}
                  </Text>
                ))}
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Cola de correos</Text>
                {workspace.mailQueue.slice(0, 5).map((item) => (
                  <Text key={item.id} style={styles.small}>
                    {item.status} · {item.recipient} · {item.subject}
                  </Text>
                ))}
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Auditoria reciente</Text>
                {workspace.auditLog.slice(0, 6).map((item) => (
                  <Text key={item.id} style={styles.small}>
                    {formatDate(item.createdAt)} · {item.action} · {item.detail}
                  </Text>
                ))}
              </View>
            </Panel>
          ) : null}

          {activeTab === 'ajustes' ? (
            <Panel title="Ajustes" subtitle="Apariencia, notificaciones y sesión.">

              {/* ── Hero de perfil ── */}
              <View style={styles.profileHeroWrap}>
                <LinearGradient colors={[theme.teal, '#77ffd1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.profileHeroBubble}>
                  {activeEmployee.avatarUri
                    ? <Image source={{ uri: activeEmployee.avatarUri }} style={{ width: 90, height: 90, borderRadius: 999 }} />
                    : <Text style={styles.profileHeroInitials}>{activeEmployee.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</Text>
                  }
                </LinearGradient>
                <Text style={styles.profileHeroName}>{activeEmployee.name}</Text>
                <Text style={styles.profileHeroRole}>{getRoleLabel(activeRole)} · {activeEmployee.email}</Text>
                <Text style={[styles.small, { marginTop: 2 }]}>{syncMode === 'firebase' ? 'Firebase' : 'Local'} · {syncing ? 'Guardando...' : formatDate(workspace.lastSyncedAt)}</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Apariencia</Text>
                <Text style={styles.muted}>Cambia entre modo oscuro y modo claro.</Text>
                <View style={styles.sessionHeader}>
                  <Tag label={themeMode === 'dark' ? 'Modo oscuro' : 'Modo claro'} />
                  <Switch
                    value={themeMode === 'dark'}
                    onValueChange={toggleThemeMode}
                    thumbColor={themeMode === 'dark' ? theme.teal : '#dce7ff'}
                    trackColor={{ false: theme.statusTrack, true: theme.tealSoft }}
                  />
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Notificaciones</Text>
                <Text style={styles.muted}>Configura cómo y cuándo recibes alertas.</Text>
                <SettingCard title="Correo automático" subtitle="Prepara el envío del PDF al cliente al crear un pedido." value={workspace.notificationSettings.autoClientEmail} onChange={(value) => updateSetting('autoClientEmail', value)} />
                <SettingCard title="Push prioritario" subtitle="Eleva eventos urgentes a notificación nativa." value={workspace.notificationSettings.highPriorityPush} onChange={(value) => updateSetting('highPriorityPush', value)} />
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Estadísticas</Text>
                <View style={styles.row}>
                  <Stat label="Activos" value={`${metrics.active}`} />
                  <Stat label="Pendientes" value={`${metrics.pending}`} />
                  <Stat label="Urgentes" value={`${metrics.urgent}`} />
                  <Stat label="Margen" value={formatCurrency(metrics.margin)} />
                </View>
              </View>

              {activeRole === 'administracion' ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Cambiar perfil</Text>
                  <Text style={styles.muted}>Cambia de perfil para validar permisos y flujo por área.</Text>
                  <View style={styles.row}>
                    {workspace.employees.map((employee) => (
                      <Chip
                        key={employee.id}
                        label={`${employee.name.split(' ')[0]} · ${getRoleLabel(employee.role)}`}
                        active={employee.id === activeEmployee.id}
                        onPress={() => { void signInWithEmployee(employee); }}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Métodos de pago</Text>
                {activeRole === 'administracion' ? (
                  <>
                    <Text style={styles.muted}>Métodos configurados por empleado.</Text>
                    {workspace.employees.filter((e) => e.role !== 'administracion').map((emp) => (
                      <View key={emp.id} style={{ marginTop: 10 }}>
                        <Text style={styles.small}>{emp.name}</Text>
                        <View style={styles.row}>
                          {PAYMENT_METHODS.map((method) => {
                            const active = (emp.paymentMethods ?? []).includes(method);
                            return (
                              <Pressable key={method} onPress={() => {
                                const updated = active ? (emp.paymentMethods ?? []).filter((m) => m !== method) : [...(emp.paymentMethods ?? []), method];
                                updateEmployeePaymentMethods(emp.id, updated);
                              }} style={styles.chipPress}>
                                <LinearGradient colors={active ? [theme.teal, '#77ffd1'] : [theme.glassStrong, 'rgba(255,255,255,0.04)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.chip, active && styles.chipActive]}>
                                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{method}</Text>
                                </LinearGradient>
                              </Pressable>
                            );
                          })}
                        </View>
                        {['Nequi', 'Daviplata', 'Bancolombia'].filter((m) => (emp.paymentMethods ?? []).includes(m)).map((method) => (
                          <View key={method} style={{ marginTop: 6 }}>
                            <Text style={[styles.small, { marginBottom: 3 }]}>{method === 'Bancolombia' ? 'Número de cuenta Bancolombia' : `Número ${method}`}</Text>
                            <TextInput
                              value={(emp.paymentAccounts ?? {})[method] ?? ''}
                              onChangeText={(v) => updateEmployeePaymentAccount(emp.id, method, v)}
                              style={styles.input}
                              keyboardType="phone-pad"
                              placeholder={method === 'Bancolombia' ? 'Ej. 123-456789-00' : 'Ej. 300 123 4567'}
                            />
                          </View>
                        ))}
                      </View>
                    ))}
                  </>
                ) : (
                  <>
                    <Text style={styles.muted}>Selecciona cómo recibes tus pagos.</Text>
                    <View style={styles.row}>
                      {PAYMENT_METHODS.map((method) => {
                        const active = (activeEmployee.paymentMethods ?? []).includes(method);
                        return (
                          <Pressable key={method} onPress={() => {
                            const updated = active ? (activeEmployee.paymentMethods ?? []).filter((m) => m !== method) : [...(activeEmployee.paymentMethods ?? []), method];
                            updateEmployeePaymentMethods(activeEmployee.id, updated);
                          }} style={styles.chipPress}>
                            <LinearGradient colors={active ? [theme.teal, '#77ffd1'] : [theme.glassStrong, 'rgba(255,255,255,0.04)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.chip, active && styles.chipActive]}>
                              <Text style={[styles.chipText, active && styles.chipTextActive]}>{method}</Text>
                            </LinearGradient>
                          </Pressable>
                        );
                      })}
                    </View>
                    {['Nequi', 'Daviplata', 'Bancolombia'].filter((m) => (activeEmployee.paymentMethods ?? []).includes(m)).map((method) => (
                      <View key={method} style={{ marginTop: 8 }}>
                        <Text style={[styles.small, { marginBottom: 3 }]}>{method === 'Bancolombia' ? 'Número de cuenta Bancolombia' : `Número ${method}`}</Text>
                        <TextInput
                          value={(activeEmployee.paymentAccounts ?? {})[method] ?? ''}
                          onChangeText={(v) => updateEmployeePaymentAccount(activeEmployee.id, method, v)}
                          style={styles.input}
                          keyboardType="phone-pad"
                          placeholder={method === 'Bancolombia' ? 'Ej. 123-456789-00' : 'Ej. 300 123 4567'}
                        />
                      </View>
                    ))}
                  </>
                )}
              </View>

              <Pressable onPress={() => { void logout(); }} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Cerrar sesión</Text>
              </Pressable>
            </Panel>
          ) : null}

          {activeTab === 'mejoras' ? (
            <Panel title={`${totalImprovements} mejoras integradas o preparadas`} subtitle="Catálogo operativo y de diseño aplicado en la solución.">
              <TextInput value={improvementQuery} onChangeText={(value) => startTransition(() => setImprovementQuery(value))} style={styles.input} placeholder="Buscar mejora..." />
              <View style={styles.row}>
                <Tag label={`${totalImprovements} mejoras`} />
                <Tag label={`${improvementCategories.filter((item) => item.state === 'Activa').length} categorías activas`} />
                <Tag label={`${improvementCategories.filter((item) => item.state === 'Preparada').length} categorías preparadas`} />
              </View>
              {filteredImprovementCategories.map((category) => (
                <View key={category.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{category.title} · {category.state}</Text>
                  {category.items.map((item) => <Text key={`${category.id}-${item}`} style={styles.listItem}>• {item}</Text>)}
                </View>
              ))}
            </Panel>
          ) : null}
        </ScrollView>
        <BottomTabBar activeTab={activeTab} onChange={setActiveTab} tabs={roleTabs} unreadCount={unreadCount} />
      </LinearGradient>
      </SafeAreaView>
    </ThemeContext.Provider>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { theme, styles } = useContext(ThemeContext);
  return (
    <LinearGradient colors={[theme.glassStrong, theme.glass]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.stat}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </LinearGradient>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { theme, styles } = useContext(ThemeContext);
  return (
    <Pressable onPress={onPress} style={styles.chipPress}>
      <LinearGradient
        colors={active ? [theme.teal, '#77ffd1'] : [theme.glassStrong, 'rgba(255,255,255,0.04)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.chip, active && styles.chipActive]}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: any }) {
  const { theme, styles } = useContext(ThemeContext);
  return (
    <BlurView intensity={42} tint={theme.paper === darkTheme.paper ? 'dark' : 'light'} style={styles.panelShell}>
      <LinearGradient colors={[theme.glassStrong, theme.glass]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.panel}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.muted}>{subtitle}</Text>
        <View style={styles.stack}>{children}</View>
      </LinearGradient>
    </BlurView>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  const { styles } = useContext(ThemeContext);
  return (
    <View style={styles.field}>
      <Text style={styles.small}>{label}</Text>
      {children}
    </View>
  );
}

function Tag({ label }: { label: string }) {
  const { theme, styles } = useContext(ThemeContext);
  return (
    <LinearGradient colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.06)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </LinearGradient>
  );
}

function Quick({ label, onPress }: { label: string; onPress: () => void }) {
  const { styles } = useContext(ThemeContext);
  return (
    <Pressable onPress={onPress} style={styles.quickPress}>
      <LinearGradient colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.05)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quick}>
        <Text style={styles.quickText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function AvatarNode({ name, uri, status, isMe }: { name: string; uri?: string; status: 'pending' | 'active' | 'completed' | 'blocked'; isMe?: boolean }) {
  const { theme, styles } = useContext(ThemeContext);
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((chunk) => chunk[0])
    .join('')
    .toUpperCase();
  return (
    <View style={[
      styles.avatar,
      { borderColor: isMe ? theme.teal : theme.stage[status] },
      isMe && styles.avatarMe,
    ]}>
      {uri
        ? <Image source={{ uri }} style={styles.avatarImage} />
        : <Text style={[styles.avatarText, isMe && { fontSize: 14, fontWeight: '900', color: theme.teal }]}>{initials}</Text>}
      {isMe ? <View style={styles.avatarMePulse} /> : null}
    </View>
  );
}

function StyledPicker({ selectedValue, onValueChange, children }: { selectedValue: string; onValueChange: (value: string) => void; children: React.ReactNode }) {
  const { theme } = useContext(ThemeContext);
  return (
    <View style={{
      borderWidth: 1,
      borderColor: theme.teal + '55',
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: theme.inputFill,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: theme.teal,
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    }}>
      <Picker
        style={{ flex: 1, color: theme.ink, height: 40, fontSize: 13 }}
        selectedValue={selectedValue}
        onValueChange={(v) => onValueChange(String(v))}
        dropdownIconColor={theme.teal}
      >
        {children}
      </Picker>
      <View style={{ paddingRight: 10, pointerEvents: 'none' as any }}>
        <Ionicons name="chevron-down" size={14} color={theme.teal} />
      </View>
    </View>
  );
}

function SettingCard({ title, subtitle, value, onChange }: { title: string; subtitle: string; value: boolean; onChange: (value: boolean) => void }) {
  const { theme, styles } = useContext(ThemeContext);
  return (
    <LinearGradient colors={[theme.glassStrong, theme.glass]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.muted}>{subtitle}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        thumbColor={value ? theme.teal : '#dce7ff'}
        trackColor={{ false: theme.statusTrack, true: theme.tealSoft }}
      />
    </LinearGradient>
  );
}

function BottomTabBar({ activeTab, onChange, tabs, unreadCount = 0 }: { activeTab: NavigationTab; onChange: (value: NavigationTab) => void; tabs: BottomTabItem[]; unreadCount?: number }) {
  const { theme, styles } = useContext(ThemeContext);
  return (
    <View style={styles.bottomShell}>
      <BlurView intensity={72} tint={theme.paper === darkTheme.paper ? 'dark' : 'light'} style={styles.bottomBar}>
        {tabs.map((item) => {
          const active = activeTab === item.key;
          const showBadge = item.key === 'notificaciones' && unreadCount > 0;
          return (
            <Pressable key={item.key} onPress={() => onChange(item.key)} style={styles.bottomItem}>
              <View>
                <LinearGradient
                  colors={active ? [theme.teal, '#77ffd1'] : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.02)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.bottomIconWrap, active && styles.bottomIconWrapActive]}
                >
                  <Ionicons name={(active ? item.icon.replace('-outline', '') : item.icon) as any} size={18} color={active ? theme.buttonText : theme.ink} />
                </LinearGradient>
                {showBadge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.bottomLabel, active && styles.bottomLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.paper },
  fill: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbTop: {
    width: 340,
    height: 340,
    top: -90,
    right: -70,
  },
  orbSide: {
    width: 300,
    height: 300,
    top: '25%',
    left: -140,
  },
  orbBottom: {
    width: 360,
    height: 360,
    right: -150,
    bottom: 40,
  },
  orbDeep: {
    width: 320,
    height: 320,
    top: '8%',
    left: -80,
  },
  orbWarm: {
    width: 230,
    height: 230,
    bottom: '12%',
    left: 20,
  },
  orbStage: {
    width: 480,
    height: 540,
    top: '18%',
    left: -80,
  },
  page: { paddingHorizontal: 10, paddingTop: 10, gap: 10, paddingBottom: 100 },
  authPage: { paddingHorizontal: 14, paddingTop: 16, gap: 14, paddingBottom: 38 },
  authPanel: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassEdge,
    gap: 10,
    shadowColor: theme.shadow,
    shadowOpacity: 0.42,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: theme.paper,
  },
  hero: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassEdgeStrong,
    gap: 4,
    shadowColor: theme.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  kicker: {
    color: theme.teal,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  title: {
    color: theme.ink,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  panelShell: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.glassEdge,
    shadowColor: theme.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  panel: {
    padding: 12,
    gap: 8,
  },
  stack: { gap: 10 },
  stat: {
    minWidth: 80,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.glassEdge,
    shadowColor: theme.glowBlue,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  metricLabel: {
    color: theme.slate,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statValue: { color: theme.ink, fontSize: 16, fontWeight: '900', marginTop: 2 },
  chipPress: {
    borderRadius: 999,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.glassEdge,
    shadowColor: theme.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  chipActive: {
    borderColor: 'rgba(255,255,255,0.24)',
  },
  chipText: { color: theme.ink, fontWeight: '700', letterSpacing: 0.2 },
  chipTextActive: { color: theme.buttonText },
  banner: {
    padding: 10,
    borderRadius: 14,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassEdge,
    gap: 4,
    shadowColor: theme.glowPink,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  bannerText: { color: theme.ink, fontWeight: '700', fontSize: 11 },
  card: {
    padding: 10,
    borderRadius: 14,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassEdge,
    gap: 6,
    shadowColor: theme.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  cardTitle: { color: theme.ink, fontSize: 13, fontWeight: '800' },
  field: { minWidth: 160, flexGrow: 1, gap: 5 },
  label: {
    color: theme.slate,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.inputEdge,
    borderRadius: 10,
    backgroundColor: theme.inputFill,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: theme.ink,
    fontSize: 13,
    shadowColor: theme.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  picker: {
    borderWidth: 1,
    borderColor: theme.inputEdge,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: theme.inputFill,
  },
  pickerInput: {
    color: theme.ink,
  },
  space: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  primaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.teal,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    shadowColor: theme.glowBlue,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  primaryButtonText: { color: theme.buttonText, fontWeight: '800', letterSpacing: 0.2, fontSize: 12 },
  quickPress: {
    borderRadius: 16,
  },
  quick: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.glassEdge,
  },
  quickText: { color: theme.ink, fontWeight: '700', fontSize: 12 },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  tagText: { color: theme.ink, fontSize: 9, fontWeight: '800', letterSpacing: 0.2 },
  sessionCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassEdge,
    gap: 10,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sessionText: {
    flex: 1,
    gap: 4,
  },
  timeline: { flexDirection: 'row', gap: 16, paddingVertical: 4 },
  flowColumn: {
    gap: 8,
  },
  flowItem: {
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  flowItemActive: {
    borderColor: theme.glassEdgeStrong,
    shadowColor: theme.glowBlue,
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  flowRail: {
    width: 40,
    alignItems: 'center',
  },
  flowConnector: {
    width: 2,
    flex: 1,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  flowConnectorActive: {
    backgroundColor: theme.teal,
  },
  flowBody: {
    flex: 1,
    gap: 6,
  },
  flowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  step: {
    width: 176,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  stepTitle: { color: theme.ink, fontWeight: '800', fontSize: 13 },
  flowOwnerText: {
    color: theme.teal,
    fontSize: 11,
    fontWeight: '800',
  },
  flowNextText: {
    color: '#ffe08a',
    fontSize: 11,
    fontWeight: '700',
  },
  primaryMini: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: theme.teal,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    shadowColor: theme.glowBlue,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  primaryMiniText: { color: theme.buttonText, fontWeight: '800', fontSize: 11 },
  listItem: { color: theme.ink, fontSize: 12, lineHeight: 18 },
  dot: { width: 28, height: 28, borderRadius: 999 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.glowBlue,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatarMe: {
    width: 50,
    height: 50,
    borderWidth: 3,
    shadowColor: theme.teal,
    shadowOpacity: 0.9,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
    backgroundColor: 'rgba(92,225,255,0.10)',
  },
  avatarMePulse: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: theme.teal,
    opacity: 0.35,
    transform: [{ scale: 1.3 }],
  },
  avatarImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  avatarText: { color: theme.ink, fontWeight: '900', fontSize: 11 },
  muted: { color: theme.slate, fontSize: 12, lineHeight: 18 },
  small: { color: theme.slate, fontSize: 10, lineHeight: 15 },
  errorText: { color: '#ff9db7', fontSize: 12, fontWeight: '700' },
  bottomShell: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 6,
  },
  bottomBar: {
    borderRadius: 18,
    paddingHorizontal: 6,
    paddingVertical: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.glassEdge,
    overflow: 'hidden',
    backgroundColor: theme.glass,
    shadowColor: theme.shadow,
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 18,
  },
  bottomItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  bottomIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  bottomIconWrapActive: {
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: theme.glowBlue,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  bottomLabel: {
    color: theme.slate,
    fontSize: 9,
    fontWeight: '700',
  },
  bottomLabelActive: {
    color: theme.ink,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: theme.paper,
    shadowColor: '#ef4444',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900' as const,
    lineHeight: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: theme.glassEdge,
    shadowColor: theme.shadow,
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 20 },
    elevation: 20,
  },
  modalCancelButton: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: theme.glass,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.glassEdge,
  },
  modalCancelText: {
    color: theme.ink,
    fontWeight: '800',
    fontSize: 13,
  },
  successModal: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 28,
    padding: 28,
    gap: 12,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: theme.glassEdge,
    shadowColor: theme.shadow,
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 20 },
    elevation: 20,
  },
  successCheck: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#22c55e',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 4,
    shadowColor: '#22c55e',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  successTitle: {
    color: theme.ink,
    fontSize: 20,
    fontWeight: '900' as const,
    textAlign: 'center' as const,
  },
  successRefBadge: {
    backgroundColor: theme.tealSoft,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.teal,
  },
  successRefText: {
    color: theme.teal,
    fontSize: 14,
    fontWeight: '900' as const,
    letterSpacing: 1,
  },
  successFurniture: {
    color: theme.ink,
    fontSize: 15,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
  },
  successDivider: {
    width: '80%',
    height: 1,
    backgroundColor: theme.glassEdge,
    marginVertical: 4,
  },
  successEmailRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassEdge,
    width: '100%',
  },
  successEmail: {
    color: theme.ink,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  notifCard: {
    flexDirection: 'row' as const,
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassEdgeStrong,
    shadowColor: theme.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  notifCardRead: {
    opacity: 0.55,
    borderColor: theme.glassEdge,
  },
  notifDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
    flexShrink: 0,
  },
  notifBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800' as const,
    letterSpacing: 0.4,
  },
  profileHeroWrap: {
    alignItems: 'center' as const,
    paddingVertical: 24,
    gap: 6,
  },
  profileHeroBubble: {
    width: 90,
    height: 90,
    borderRadius: 999,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: theme.teal,
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    marginBottom: 8,
  },
  profileHeroInitials: {
    color: '#0a1628',
    fontSize: 32,
    fontWeight: '900' as const,
    letterSpacing: 1,
  },
  profileHeroName: {
    color: theme.ink,
    fontSize: 20,
    fontWeight: '800' as const,
    letterSpacing: 0.3,
  },
  profileHeroRole: {
    color: theme.teal,
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
  });
}
