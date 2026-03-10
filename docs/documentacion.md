# Documentación funcional

## Objetivo

TallerFlow Muebles centraliza la operación de fabricación del mueble desde el segundo cero:

1. El comercial registra la solicitud.
2. Administración aprueba el pedido y configura el flujo.
3. Cada responsable inicia y finaliza su etapa.
4. El cliente recibe un PDF de seguimiento o cierre.

## Roles

- Comercial: crea la solicitud y mantiene relación con cliente.
- Administración: aprueba, define precio, margen, responsables y regla de pago.
- Diseño: prepara especificaciones técnicas.
- Carpintería: ejecuta estructura, corte y ensamble.
- Tapicería: resuelve piezas blandas, costuras y acabados textiles.
- Calidad: valida conformidad antes de despacho.
- Despacho: cierra salida y entrega.

## Módulos principales

- Dashboard: KPIs, urgencias y atajos.
- Solicitudes: formulario inicial del pedido.
- Administración: asignación de usuarios, orden del flujo y precio.
- Flujo: línea de producción por nodos con estado.
- Notificaciones: alertas, lectura y configuración rápida.
- Clientes: PDF, compartir y correo.
- Equipo: carga operativa y ganancia estimada.
- Mejoras: catálogo de 250 mejoras integradas o preparadas.

## Persistencia y sincronización

- Local: AsyncStorage.
- Remota: Firestore si `EXPO_PUBLIC_FIREBASE_*` está configurado.
- Reglas e índices: incluidos en el repositorio.
- Funciones: ejemplo base en `firebase/functions`.

## PDF y correo

- En nativo: se genera PDF y se prepara el correo con adjunto.
- En web: se abre impresión y `mailto`.
- En backend: se dejó preparada la capa Firebase para una cola de correo real.

