import { OrderStatus, Priority, RoleId, StageStatus } from '../types';
import { roleLabels } from '../constants/theme';

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatDate(value?: string) {
  if (!value) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatDateOnly(value?: string) {
  if (!value) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

export function getRoleLabel(role: RoleId) {
  return roleLabels[role];
}

export function getStageStatusLabel(status: StageStatus) {
  if (status === 'active') {
    return 'En proceso';
  }

  if (status === 'completed') {
    return 'Completada';
  }

  if (status === 'blocked') {
    return 'Bloqueada';
  }

  return 'Pendiente';
}

export function getOrderStatusLabel(status: OrderStatus) {
  if (status === 'pending_approval') {
    return 'Pendiente de aprobación';
  }

  if (status === 'approved') {
    return 'Aprobado';
  }

  if (status === 'in_progress') {
    return 'En producción';
  }

  if (status === 'blocked') {
    return 'Bloqueado';
  }

  return 'Completado';
}

export function getPriorityLabel(priority: Priority) {
  return priority;
}

export function getDaysRemaining(dateString: string) {
  const due = new Date(dateString).getTime();
  const now = Date.now();
  const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

  if (Number.isNaN(diff)) {
    return 'Sin fecha';
  }

  if (diff < 0) {
    return `Vencido hace ${Math.abs(diff)} día(s)`;
  }

  if (diff === 0) {
    return 'Vence hoy';
  }

  return `Faltan ${diff} día(s)`;
}

export function clampNumber(value: string, fallback = 0) {
  const parsed = Number(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}
