import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { createContext, startTransition, useContext, useDeferredValue, useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { improvementCategories, totalImprovements } from './src/constants/improvements';
import { AppTheme, darkTheme, lightTheme } from './src/constants/theme';
import { emptyOrderDraft, seedWorkspace } from './src/data/seed';
import { prepareLocalNotifications, sendLocalNotification } from './src/services/notifications';
import { composeOrderEmail, createOrderPdf, sharePdf } from './src/services/pdf';
import { clearSession, loadSession, loadThemeMode, loadWorkspace, persistSession, persistThemeMode, persistWorkspace } from './src/services/repository';
import { AppNotification, AuthSession, Employee, FurnitureOrder, NavigationTab, OrderDraft, PayoutRule, RoleId, WorkspaceState } from './src/types';
import { clampNumber, formatCurrency, formatDate, formatDateOnly, getDaysRemaining, getOrderStatusLabel, getRoleLabel, getStageStatusLabel } from './src/utils/format';
import { computeSystemHealth, createAuditEntry, createMailQueueItem, createSyncJob } from './src/utils/backend';
import { buildOrderFromDraft, createNotification, createOrderEvent, deriveOrderStatus, findEmployeeByRole, getActiveStage, getCurrentExecutableStage, getOrderProgress, updateMargins } from './src/utils/order';

const MATERIALS = ['Madera flor morado', 'Cedro', 'Roble', 'Nogal', 'Melamina RH', 'Metal y madera'];
const PAY_RULES: PayoutRule[] = ['Al registrar', 'Al aprobar', 'Al iniciar', 'Al finalizar', 'Contra entrega'];
const DEMO_PASSWORD = 'TallerFlow2026';
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
      <LinearGradient colors={[theme.glowBlue, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.orb, styles.orbTop]} />
      <LinearGradient colors={[theme.glowPink, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.orb, styles.orbSide]} />
      <LinearGradient colors={[theme.glowMint, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.orb, styles.orbBottom]} />
      <View style={styles.mesh} />
    </View>
  );
}

function getTabsForRole(role: RoleId): BottomTabItem[] {
  if (role === 'comercial') {
    return [
      { key: 'solicitudes', label: 'Formulario', icon: 'document-text-outline' },
      { key: 'notificaciones', label: 'Alertas', icon: 'notifications-outline' },
    ];
  }

  if (role === 'administracion') {
    return [
      { key: 'administracion', label: 'Pagos', icon: 'wallet-outline' },
      { key: 'flujo', label: 'Tareas', icon: 'play-circle-outline' },
      { key: 'notificaciones', label: 'Alertas', icon: 'notifications-outline' },
      { key: 'dashboard', label: 'Historial', icon: 'time-outline' },
    ];
  }

  return [
    { key: 'flujo', label: 'Tareas', icon: 'play-circle-outline' },
    { key: 'notificaciones', label: 'Alertas', icon: 'notifications-outline' },
    { key: 'dashboard', label: 'Historial', icon: 'time-outline' },
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
  const [statusMessage, setStatusMessage] = useState('Proyecto listo en modo local.');
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
      setStatusMessage(loaded.mode === 'firebase' ? 'Datos cargados desde Firebase.' : 'Datos cargados en almacenamiento local.');
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
      .filter((stage) => stage.status === 'completed' && stage.payout > 0)
      .map((stage) => ({ order, stage, employee: workspace.employees.find((item) => item.id === stage.assigneeId) })),
  );
  const openAssignments = assignedStages.filter(({ stage }) => stage.status !== 'completed');
  const completedAssignments = assignedStages.filter(({ stage }) => stage.status === 'completed');
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
    if (activeRole !== 'comercial') {
      setStatusMessage('Solo el rol comercial puede crear solicitudes.');
      return;
    }
    if (!draft.clientName || !draft.clientEmail || !draft.furnitureName || !draft.size || !draft.estimatedCost) {
      setStatusMessage('Completa cliente, mueble, tamaño y costo.');
      return;
    }
    const order = buildOrderFromDraft(draft, workspace.employees, activeEmployee.id);
    const admin = findEmployeeByRole(workspace.employees, 'administracion');
    const notification = createNotification('Nuevo pedido pendiente', `${order.reference} requiere validación administrativa.`, [admin.name], 'Alta', order.id, 'Aprobar');
    mutate(
      (current) => ({ ...current, orders: [order, ...current.orders], notifications: [notification, ...current.notifications] }),
      `Solicitud ${order.reference} creada y enviada a administracion.`,
      notification,
      {
        action: 'create_order',
        detail: `Se registro la solicitud ${order.reference} y se envio a aprobacion.`,
        entityId: order.id,
        entityType: 'order',
        orderId: order.id,
      },
    );
    setSelectedOrderId(order.id);
    setDraft(freshDraft());
    setActiveTab('notificaciones');
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
                <Text style={styles.kicker}>TallerFlow / acceso</Text>
                <Text style={styles.title}>Inicia sesion para probar los flujos por rol.</Text>
                <Text style={styles.muted}>
                  Cada perfil abre permisos distintos para comercial, administracion, diseno, produccion, calidad y despacho.
                </Text>
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
          <View style={styles.hero}>
            <Text style={styles.kicker}>TallerFlow · muebles</Text>
            <Text style={styles.title}>Gestiona el mueble desde la solicitud hasta la entrega.</Text>
            <Text style={styles.muted}>Rol activo: {getRoleLabel(activeRole)} · Usuario: {activeEmployee.name}</Text>
            <Text style={styles.small}>Sincronización: {syncMode === 'firebase' ? 'Firebase' : 'Local'} · {syncing ? 'Guardando...' : formatDate(workspace.lastSyncedAt)}</Text>
          </View>

          <View style={styles.row}>
            <Stat label="Activos" value={`${metrics.active}`} />
            <Stat label="Pendientes" value={`${metrics.pending}`} />
            <Stat label="Urgentes" value={`${metrics.urgent}`} />
            <Stat label="Margen" value={formatCurrency(metrics.margin)} />
          </View>

          <View style={styles.row}>
            <Tag label={`Rol ${getRoleLabel(activeRole)}`} />
            <Tag label={activeEmployee.email} />
            <Quick label={activeRole === 'comercial' ? 'Alertas' : 'Historial'} onPress={() => setActiveTab(activeRole === 'comercial' ? 'notificaciones' : 'dashboard')} />
            <Quick label="Cerrar sesion" onPress={() => { void logout(); }} />
          </View>

          <View style={styles.banner}>
            <Text style={styles.bannerText}>{statusMessage}</Text>
            <Text style={styles.small}>{unreadCount} notificación(es) sin leer</Text>
          </View>

          <View style={styles.sessionCard}>
            <View style={styles.sessionHeader}>
              <View style={styles.sessionText}>
                <Text style={styles.cardTitle}>Sesion y apariencia</Text>
                <Text style={styles.muted}>Cierra la sesion actual o cambia entre modo oscuro y modo claro.</Text>
              </View>
              <Switch
                value={themeMode === 'dark'}
                onValueChange={toggleThemeMode}
                thumbColor={themeMode === 'dark' ? theme.teal : '#dce7ff'}
                trackColor={{ false: theme.statusTrack, true: theme.tealSoft }}
              />
            </View>
            <View style={styles.row}>
              <Tag label={themeMode === 'dark' ? 'Modo oscuro' : 'Modo claro'} />
              <Quick label="Cerrar sesion" onPress={() => { void logout(); }} />
            </View>
          </View>

          {(activeTab === 'dashboard' || activeTab === 'administracion' || activeTab === 'flujo' || activeTab === 'clientes') && selectedOrder ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.row}>
                {visibleOrders.map((order) => (
                  <Chip key={order.id} label={`${order.reference} · ${order.client.name}`} active={selectedOrder.id === order.id} onPress={() => setSelectedOrderId(order.id)} />
                ))}
              </View>
            </ScrollView>
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
                <Field label="Cliente"><TextInput value={draft.clientName} onChangeText={(value) => updateDraft('clientName', value)} style={styles.input} placeholder="Nombre del cliente" /></Field>
                <Field label="Correo"><TextInput value={draft.clientEmail} onChangeText={(value) => updateDraft('clientEmail', value)} style={styles.input} placeholder="cliente@correo.co" /></Field>
                <Field label="Teléfono"><TextInput value={draft.clientPhone} onChangeText={(value) => updateDraft('clientPhone', value)} style={styles.input} placeholder="+57 300..." /></Field>
                <Field label="Ciudad"><TextInput value={draft.clientCity} onChangeText={(value) => updateDraft('clientCity', value)} style={styles.input} placeholder="Bogotá" /></Field>
                <Field label="Mueble"><TextInput value={draft.furnitureName} onChangeText={(value) => updateDraft('furnitureName', value)} style={styles.input} placeholder="Sofá, poltrona..." /></Field>
                <Field label="Material">
                  <View style={styles.picker}><Picker style={styles.pickerInput} selectedValue={draft.material} onValueChange={(value) => updateDraft('material', String(value))}>{MATERIALS.map((material) => <Picker.Item key={material} label={material} value={material} />)}</Picker></View>
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
              <Pressable onPress={createOrder} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Enviar solicitud a administración</Text></Pressable>
            </Panel>
          ) : null}

          {activeTab === 'administracion' ? (
            <Panel title="Aprobar y orquestar" subtitle="Precio final, responsables y pagos pendientes por liberar.">
              <View style={styles.row}>
                <Stat label="Pendientes" value={`${visibleOrders.filter((order) => order.status === 'pending_approval').length}`} />
                <Stat label="Pagos" value={`${pendingPayouts.length}`} />
                <Stat label="Total" value={formatCurrency(pendingPayoutTotal)} />
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Pagos pendientes del taller</Text>
                {pendingPayouts.slice(0, 5).map(({ order, stage, employee }) => (
                  <Text key={`${order.id}-${stage.id}`} style={styles.small}>
                    {order.reference} · {stage.title} · {employee?.name ?? 'Sin responsable'} · {formatCurrency(stage.payout)}
                  </Text>
                ))}
                {!pendingPayouts.length ? <Text style={styles.muted}>No hay pagos pendientes en este momento.</Text> : null}
              </View>
              {selectedOrder ? (
                <>
                  <View style={styles.row}>
                    <Field label="Costo producción"><TextInput value={`${selectedOrder.pricing.productionCost}`} onChangeText={(value) => updatePricing(selectedOrder.id, 'productionCost', value)} style={styles.input} keyboardType="numeric" /></Field>
                    <Field label="Precio final"><TextInput value={`${selectedOrder.pricing.finalPrice}`} onChangeText={(value) => updatePricing(selectedOrder.id, 'finalPrice', value)} style={styles.input} keyboardType="numeric" /></Field>
                  </View>
                  <Field label="Nota administrativa"><TextInput value={selectedOrder.pricing.adminNote} onChangeText={(value) => updateAdminNote(selectedOrder.id, value)} style={[styles.input, styles.multiline]} multiline /></Field>
                  {selectedOrder.stages.map((stage) => (
                    <View key={stage.id} style={styles.card}>
                      <Text style={styles.cardTitle}>{stage.title}</Text>
                      <Text style={styles.small}>{getRoleLabel(stage.role)} · {getStageStatusLabel(stage.status)}</Text>
                      <View style={styles.row}>
                        <Field label="Responsable">
                          <View style={styles.picker}>
                            <Picker style={styles.pickerInput} selectedValue={stage.assigneeId} onValueChange={(value) => assignStage(selectedOrder.id, stage.id, String(value))}>
                              {workspace.employees.filter((employee) => employee.role === stage.role).map((employee) => <Picker.Item key={employee.id} label={employee.name} value={employee.id} />)}
                            </Picker>
                          </View>
                        </Field>
                        <Field label="Gana"><TextInput value={`${stage.payout}`} onChangeText={(value) => updateStagePayout(selectedOrder.id, stage.id, value)} style={styles.input} keyboardType="numeric" /></Field>
                        <Field label="Cuándo gana">
                          <View style={styles.picker}>
                            <Picker style={styles.pickerInput} selectedValue={stage.payoutRule} onValueChange={(value) => updateStageRule(selectedOrder.id, stage.id, value as PayoutRule)}>
                              {PAY_RULES.map((rule) => <Picker.Item key={rule} label={rule} value={rule} />)}
                            </Picker>
                          </View>
                        </Field>
                      </View>
                      <View style={styles.row}>
                        <Quick label="Subir" onPress={() => moveStage(selectedOrder.id, stage.id, -1)} />
                        <Quick label="Bajar" onPress={() => moveStage(selectedOrder.id, stage.id, 1)} />
                      </View>
                    </View>
                  ))}
                  <View style={styles.row}>
                    <Tag label={`Margen ${formatCurrency(selectedOrder.pricing.expectedMargin)}`} />
                    <Tag label={`Entrega ${formatDateOnly(selectedOrder.dueDate)}`} />
                  </View>
                  <Pressable onPress={() => approveOrder(selectedOrder.id)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Aprobar pedido y liberar producción</Text></Pressable>
                </>
              ) : <Text style={styles.muted}>No hay pedidos para administrar.</Text>}
            </Panel>
          ) : null}

          {activeTab === 'flujo' ? (
            <Panel title="Flujo del pedido" subtitle="Linea vertical para ver quien tiene el pedido y que tarea sigue.">
              {selectedOrder ? (
                <>
                  <View style={styles.flowColumn}>
                    {selectedOrder.stages.map((stage, index) => {
                      const unlocked = getCurrentExecutableStage(selectedOrder);
                      const activeStage = getActiveStage(selectedOrder);
                      const canOperate = activeRole === 'administracion' || (stage.role === activeRole && (stage.status === 'active' || unlocked?.id === stage.id));
                      const employee = workspace.employees.find((item) => item.id === stage.assigneeId);
                      const hasOrderNow = activeStage?.id === stage.id || (!activeStage && unlocked?.id === stage.id);
                      const isNext = !hasOrderNow && unlocked?.id === stage.id;

                      return (
                        <View key={stage.id} style={[styles.flowItem, hasOrderNow && styles.flowItemActive]}>
                          <View style={styles.flowRail}>
                            <AvatarNode name={employee?.name ?? 'SR'} uri={employee?.avatarUri} status={stage.status} />
                            {index < selectedOrder.stages.length - 1 ? <View style={[styles.flowConnector, hasOrderNow && styles.flowConnectorActive]} /> : null}
                          </View>
                          <View style={styles.flowBody}>
                            <View style={styles.flowHeader}>
                              <Text style={styles.stepTitle}>{stage.title}</Text>
                              <Tag label={getStageStatusLabel(stage.status)} />
                            </View>
                            <Text style={styles.muted}>{employee?.name ?? 'Sin responsable'} · {getRoleLabel(stage.role)}</Text>
                            {hasOrderNow ? <Text style={styles.flowOwnerText}>Este usuario tiene el pedido ahora.</Text> : null}
                            {isNext ? <Text style={styles.flowNextText}>Siguiente responsable en cola.</Text> : null}
                            <Text style={styles.small}>Pago {formatCurrency(stage.payout)} · {stage.payoutRule}</Text>
                            <View style={styles.row}>
                              {canOperate && stage.status === 'pending' ? <Pressable onPress={() => startStage(selectedOrder.id, stage.id)} style={styles.primaryMini}><Text style={styles.primaryMiniText}>Iniciar tarea</Text></Pressable> : null}
                              {canOperate && stage.status === 'active' ? <Pressable onPress={() => completeStage(selectedOrder.id, stage.id)} style={styles.primaryMini}><Text style={styles.primaryMiniText}>Finalizar tarea</Text></Pressable> : null}
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                  {selectedOrder.events.slice().reverse().map((event) => (
                    <View key={event.id} style={styles.card}>
                      <Text style={styles.cardTitle}>{event.title}</Text>
                      <Text style={styles.muted}>{event.body}</Text>
                      <Text style={styles.small}>{formatDate(event.createdAt)}</Text>
                    </View>
                  ))}
                </>
              ) : <Text style={styles.muted}>Selecciona un pedido para ver el flujo.</Text>}
            </Panel>
          ) : null}

          {activeTab === 'notificaciones' ? (
            <Panel title="Notificaciones avanzadas" subtitle="Centro operativo con prioridad, canal, lectura y preferencias rápidas.">
              <View style={styles.row}>
                <SettingCard title="Correo automático" subtitle="Prepara el envío del PDF al cliente." value={workspace.notificationSettings.autoClientEmail} onChange={(value) => updateSetting('autoClientEmail', value)} />
                <SettingCard title="Push prioritario" subtitle="Eleva eventos urgentes a notificación nativa." value={workspace.notificationSettings.highPriorityPush} onChange={(value) => updateSetting('highPriorityPush', value)} />
              </View>
              <TextInput value={notificationQuery} onChangeText={(value) => startTransition(() => setNotificationQuery(value))} style={styles.input} placeholder="Buscar notificación..." />
              {filteredNotifications.map((notification) => (
                <View key={notification.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{notification.title}</Text>
                  <Text style={styles.muted}>{notification.body}</Text>
                  <Text style={styles.small}>{notification.recipients.join(', ')} · {formatDate(notification.createdAt)}</Text>
                  <View style={styles.row}>{notification.channels.map((channel) => <Tag key={`${notification.id}-${channel}`} label={channel} />)}</View>
                  {!notification.read ? <Pressable onPress={() => markRead(notification.id)} style={styles.primaryMini}><Text style={styles.primaryMiniText}>Marcar leída</Text></Pressable> : <Text style={styles.small}>Leída</Text>}
                </View>
              ))}
              {!filteredNotifications.length ? <Text style={styles.muted}>No hay notificaciones para este usuario.</Text> : null}
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
                <Text style={styles.muted}>{activeEmployee.name} · {getRoleLabel(activeEmployee.role)} · {activeEmployee.email}</Text>
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
        <BottomTabBar activeTab={activeTab} onChange={setActiveTab} tabs={roleTabs} />
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

function AvatarNode({ name, uri, status }: { name: string; uri?: string; status: 'pending' | 'active' | 'completed' | 'blocked' }) {
  const { theme, styles } = useContext(ThemeContext);
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((chunk) => chunk[0])
    .join('')
    .toUpperCase();
  return (
    <View style={[styles.avatar, { borderColor: theme.stage[status] }]}>
      {uri ? <Image source={{ uri }} style={styles.avatarImage} /> : null}
      <Text style={styles.avatarText}>{initials}</Text>
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

function BottomTabBar({ activeTab, onChange, tabs }: { activeTab: NavigationTab; onChange: (value: NavigationTab) => void; tabs: BottomTabItem[] }) {
  const { theme, styles } = useContext(ThemeContext);
  return (
    <View style={styles.bottomShell}>
      <BlurView intensity={72} tint={theme.paper === darkTheme.paper ? 'dark' : 'light'} style={styles.bottomBar}>
        {tabs.map((item) => {
          const active = activeTab === item.key;
          return (
            <Pressable key={item.key} onPress={() => onChange(item.key)} style={styles.bottomItem}>
              <LinearGradient
                colors={active ? [theme.teal, '#77ffd1'] : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.02)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.bottomIconWrap, active && styles.bottomIconWrapActive]}
              >
                <Ionicons name={(active ? item.icon.replace('-outline', '') : item.icon) as any} size={18} color={active ? theme.buttonText : theme.ink} />
              </LinearGradient>
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
    width: 260,
    height: 260,
    top: -60,
    right: -40,
  },
  orbSide: {
    width: 240,
    height: 240,
    top: '28%',
    left: -110,
  },
  orbBottom: {
    width: 280,
    height: 280,
    right: -120,
    bottom: 60,
  },
  mesh: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    bottom: 18,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: theme.glassEdge,
  },
  page: { paddingHorizontal: 14, paddingTop: 16, gap: 14, paddingBottom: 132 },
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
    padding: 18,
    borderRadius: 24,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassEdgeStrong,
    gap: 8,
    shadowColor: theme.shadow,
    shadowOpacity: 0.44,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 18,
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
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  panelShell: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.glassEdge,
    shadowColor: theme.shadow,
    shadowOpacity: 0.44,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 20 },
    elevation: 18,
  },
  panel: {
    padding: 16,
    gap: 10,
  },
  stack: { gap: 10 },
  stat: {
    minWidth: 128,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.glassEdge,
    shadowColor: theme.glowBlue,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  metricLabel: {
    color: theme.slate,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statValue: { color: theme.ink, fontSize: 20, fontWeight: '900', marginTop: 4 },
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
    padding: 16,
    borderRadius: 22,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassEdge,
    gap: 6,
    shadowColor: theme.glowPink,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  bannerText: { color: theme.ink, fontWeight: '800', fontSize: 13 },
  card: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassEdge,
    gap: 8,
    shadowColor: theme.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  cardTitle: { color: theme.ink, fontSize: 15, fontWeight: '800' },
  field: { minWidth: 220, flexGrow: 1, gap: 7 },
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
    borderRadius: 14,
    backgroundColor: theme.inputFill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: theme.ink,
    shadowColor: theme.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
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
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: theme.teal,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    shadowColor: theme.glowBlue,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  primaryButtonText: { color: theme.buttonText, fontWeight: '900', letterSpacing: 0.2, fontSize: 13 },
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  tagText: { color: theme.ink, fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
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
    gap: 12,
  },
  flowItem: {
    flexDirection: 'row',
    gap: 14,
    padding: 14,
    borderRadius: 20,
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
    width: 56,
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
  stepTitle: { color: theme.ink, fontWeight: '800' },
  flowOwnerText: {
    color: theme.teal,
    fontSize: 12,
    fontWeight: '800',
  },
  flowNextText: {
    color: '#ffe08a',
    fontSize: 12,
    fontWeight: '700',
  },
  primaryMini: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: theme.teal,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    shadowColor: theme.glowBlue,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  primaryMiniText: { color: theme.buttonText, fontWeight: '800', fontSize: 12 },
  listItem: { color: theme.ink, fontSize: 12, lineHeight: 18 },
  dot: { width: 28, height: 28, borderRadius: 999 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 999,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.glowBlue,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  avatarImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  avatarText: { color: theme.ink, fontWeight: '900' },
  muted: { color: theme.slate, fontSize: 12, lineHeight: 18 },
  small: { color: theme.slate, fontSize: 10, lineHeight: 15 },
  errorText: { color: '#ff9db7', fontSize: 12, fontWeight: '700' },
  bottomShell: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
  },
  bottomBar: {
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 9,
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
  });
}
