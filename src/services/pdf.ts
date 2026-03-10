import * as MailComposer from 'expo-mail-composer';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';
import { Employee, FurnitureOrder } from '../types';
import { formatCurrency, formatDateOnly, getRoleLabel, getStageStatusLabel } from '../utils/format';

function findAssigneeName(employees: Employee[], assigneeId: string) {
  return employees.find((employee) => employee.id === assigneeId)?.name ?? 'Sin asignar';
}

export function buildOrderHtml(order: FurnitureOrder, employees: Employee[]) {
  const stageRows = order.stages
    .map(
      (stage) => `
        <tr>
          <td>${stage.title}</td>
          <td>${getRoleLabel(stage.role)}</td>
          <td>${findAssigneeName(employees, stage.assigneeId)}</td>
          <td>${getStageStatusLabel(stage.status)}</td>
          <td>${formatCurrency(stage.payout)}</td>
        </tr>
      `,
    )
    .join('');

  return `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 28px; color: #14212b; }
          h1, h2 { margin-bottom: 6px; }
          .hero { background: #f6f1e7; border-radius: 18px; padding: 18px 22px; margin-bottom: 22px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
          .card { background: #fff9ef; border: 1px solid #e9dcc7; border-radius: 14px; padding: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          th, td { padding: 10px 8px; border-bottom: 1px solid #eadfcb; text-align: left; }
          th { background: #f7e2bc; }
          .footer { margin-top: 28px; color: #54616d; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="hero">
          <h1>${order.reference} · ${order.furnitureName}</h1>
          <p>Cliente: ${order.client.name} · ${order.client.email} · ${order.client.phone}</p>
          <p>Ciudad: ${order.client.city} · Entrega objetivo: ${formatDateOnly(order.dueDate)}</p>
        </div>
        <div class="grid">
          <div class="card">
            <h2>Especificaciones</h2>
            <p>Material: ${order.material}</p>
            <p>Tamaño: ${order.size}</p>
            <p>Almohadas: ${order.needsCushions ? 'Sí' : 'No'}</p>
            <p>Notas: ${order.notes || 'Sin notas'}</p>
          </div>
          <div class="card">
            <h2>Costos</h2>
            <p>Costo de producción: ${formatCurrency(order.pricing.productionCost)}</p>
            <p>Precio final: ${formatCurrency(order.pricing.finalPrice)}</p>
            <p>Margen esperado: ${formatCurrency(order.pricing.expectedMargin)}</p>
          </div>
        </div>
        <h2>Flujo operativo</h2>
        <table>
          <thead>
            <tr>
              <th>Etapa</th>
              <th>Rol</th>
              <th>Responsable</th>
              <th>Estado</th>
              <th>Ganancia</th>
            </tr>
          </thead>
          <tbody>${stageRows}</tbody>
        </table>
        <div class="footer">
          Documento generado por TallerFlow para seguimiento del pedido.
        </div>
      </body>
    </html>
  `;
}

export async function createOrderPdf(order: FurnitureOrder, employees: Employee[]) {
  const html = buildOrderHtml(order, employees);

  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return null;
  }

  const result = await Print.printToFileAsync({ html });
  return result.uri;
}

export async function sharePdf(uri: string | null) {
  if (!uri) {
    return false;
  }

  const canShare = await Sharing.isAvailableAsync();

  if (!canShare) {
    return false;
  }

  await Sharing.shareAsync(uri);
  return true;
}

export async function composeOrderEmail(order: FurnitureOrder, uri: string | null) {
  const subject = `Actualización de su pedido ${order.reference}`;
  const body = `Hola ${order.client.name}, adjuntamos el PDF de seguimiento de su mueble ${order.furnitureName}.`;

  if (Platform.OS === 'web') {
    await Linking.openURL(
      `mailto:${encodeURIComponent(order.client.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    );
    return false;
  }

  const isAvailable = await MailComposer.isAvailableAsync();

  if (!isAvailable) {
    return false;
  }

  await MailComposer.composeAsync({
    recipients: [order.client.email],
    subject,
    body,
    attachments: uri ? [uri] : [],
  });
  return true;
}
