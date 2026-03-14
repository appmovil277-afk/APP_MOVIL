<p align="center">
  <img src="assets/icon.png" alt="TallerFlow Muebles" width="120" />
</p>

<h1 align="center">TallerFlow Muebles</h1>

<p align="center">
  <strong>Sistema integral de gestión de producción de muebles a medida</strong><br/>
  Aplicación móvil y web multiplataforma construida con Expo · React Native · Firebase
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Expo-55.0.5-000020?logo=expo" alt="Expo" />
  <img src="https://img.shields.io/badge/React_Native-0.83.2-61DAFB?logo=react" alt="React Native" />
  <img src="https://img.shields.io/badge/Firebase-12.10.0-FFCA28?logo=firebase" alt="Firebase" />
  <img src="https://img.shields.io/badge/TypeScript-5.9.2-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Platform-iOS%20%7C%20Android%20%7C%20Web-brightgreen" alt="Platform" />
  <img src="https://img.shields.io/badge/License-Private-red" alt="License" />
</p>

---

##  Tabla de Contenidos

- [Descripción General](#-descripción-general)
- [Características Principales](#-características-principales)
- [Arquitectura del Sistema](#-arquitectura-del-sistema)
- [Modelo de Datos](#-modelo-de-datos)
- [Roles y Permisos](#-roles-y-permisos)
- [Flujo de Trabajo de un Pedido](#-flujo-de-trabajo-de-un-pedido)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Stack Tecnológico](#-stack-tecnológico)
- [Instalación y Configuración](#-instalación-y-configuración)
- [Scripts Disponibles](#-scripts-disponibles)
- [Integración Firebase](#-integración-firebase)
- [Cloud Functions](#-cloud-functions)
- [Generación de PDF y Correos](#-generación-de-pdf-y-correos)
- [Sistema de Notificaciones](#-sistema-de-notificaciones)
- [Persistencia y Sincronización](#-persistencia-y-sincronización)
- [Sistema de Diseño (UI/UX)](#-sistema-de-diseño-uiux)
- [Catálogo de Mejoras](#-catálogo-de-mejoras)
- [Variables de Entorno](#-variables-de-entorno)
- [Despliegue](#-despliegue)
- [Contribución](#-contribución)

---

##  Descripción General

**TallerFlow Muebles** es una aplicación móvil y web diseñada para digitalizar y optimizar la operación completa de un taller de muebles a medida. Cubre todo el ciclo de vida de un pedido: desde la captura comercial del cliente hasta la entrega final, pasando por diseño técnico, carpintería, tapicería, control de calidad y despacho.

La aplicación está pensada para equipos de trabajo donde cada miembro tiene un rol específico dentro de la cadena de producción. Cada rol solo ve y puede interactuar con las etapas que le corresponden, mientras que el administrador tiene visibilidad y control total.

### ¿Qué problema resuelve?

| Problema | Solución TallerFlow |
|----------|---------------------|
| Pedidos en papel o WhatsApp | Formulario digital estructurado con referencia única |
| Sin visibilidad del estado | Dashboard con KPIs en tiempo real y progreso por etapa |
| Pagos desordenados | Seguimiento de pagos por etapa con reglas configurables |
| Comunicación informal | Centro de notificaciones multicanal con historial |
| Sin trazabilidad | Log de auditoría automático de todas las acciones |
| Documentación manual | Generación automática de PDF y envío por correo |

---

##  Características Principales

###  Dashboard Inteligente
- Tarjetas KPI: pedidos activos, asignaciones, alertas sin leer, ítems urgentes
- Acciones rápidas: nueva solicitud, mis pedidos, mis tareas
- Vista previa de pedidos recientes con barra de progreso
- Alertas no leídas destacadas
- Historial operacional en tiempo real

###  Captura Comercial
- Formulario completo: datos del cliente (nombre, email, teléfono, ciudad)
- Especificaciones del mueble: nombre, material (6 opciones), tamaño, almohadas
- Costo estimado con validación de moneda colombiana (COP)
- Fecha de entrega con cálculo automático (+12 días)
- Notas y etiquetas personalizables
- **4 plantillas de flujo de trabajo**: completo, sin diseño, solo tapicería, vacío
- Constructor personalizado de etapas

###  Panel de Administración
- Aprobación explícita de pedidos pendientes
- Edición de precio final, margen y costo de producción
- Reasignación de etapas a diferentes empleados
- Configuración de montos y reglas de pago por etapa
- Reordenamiento de etapas del flujo de trabajo
- Marcado de etapas como pagadas
- Cambio de prioridad (Alta / Media / Baja)

###  Flujo de Producción
- Ejecución secuencial de etapas con avance automático
- Colores por estado: pendiente (gris), activo (cian), completado (verde), bloqueado (rosa)
- Timestamps automáticos de inicio y fin
- Cálculo de progreso en porcentaje
- Filtrado por rol activo

###  Generación de Documentos
- PDF profesional con datos del cliente, especificaciones, costos y flujo completo
- Compartir vía hoja de compartir nativa del dispositivo
- Composición de email con adjunto PDF
- Fallback `mailto:` para plataforma web

###  Centro de Notificaciones
- Creación automática en: creación de pedido, aprobación, inicio/fin de etapa, completado
- Prioridades: Alta, Media, Baja
- Canales: In-app, Push, Email, WhatsApp (preparado)
- Búsqueda y filtrado por texto
- Badge con contador de no leídas
- Navegación directa al pedido relacionado

###  Gestión de Equipo
- Directorio completo de empleados con búsqueda
- Indicadores: disponibilidad, especialidades, tareas activas, ganancias estimadas, rendimiento
- Configuración de métodos de pago por empleado (Nequi, Daviplata, Bancolombia)

###  Historial y Trazabilidad
- Pedidos completados con indicadores de pago
- Log de auditoría automático de todas las mutaciones
- Cola de sincronización con estado de cada operación
- Cola de correos electrónicos con seguimiento

###  Experiencia de Usuario
- Diseño glassmorphism con efectos de desenfoque y gradientes
- Tema oscuro (aurora boreal) y tema claro
- Barra de navegación inferior estilo iPhone
- Componentes reutilizables: Stat, Chip, Panel, Field, Tag, AvatarNode
- Responsive para móvil y web

---

##  Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE PRESENTACIÓN                      │
│  App.tsx (monolito React con Context + Estado local)         │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│  │Dashb.│ │Solic.│ │Flujo │ │Hist. │ │Notif.│ │Config│    │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘    │
├─────────────────────────────────────────────────────────────┤
│                    CAPA DE LÓGICA                            │
│  utils/order.ts    → Creación de pedidos, flujo, progreso   │
│  utils/format.ts   → Moneda COP, fechas, etiquetas          │
│  utils/backend.ts  → IDs, auditoría, cola sync, salud       │
├─────────────────────────────────────────────────────────────┤
│                    CAPA DE SERVICIOS                         │
│  services/repository.ts   → Persistencia dual (local+cloud) │
│  services/firebase.ts     → Firestore CRUD                  │
│  services/notifications.ts→ Push local + web notifications   │
│  services/pdf.ts          → HTML→PDF + compartir + email     │
├─────────────────────────────────────────────────────────────┤
│                    CAPA DE DATOS                             │
│  AsyncStorage (local)  ←──→  Firestore (nube)               │
│  data/seed.ts (datos iniciales de demostración)              │
├─────────────────────────────────────────────────────────────┤
│                    CAPA DE BACKEND                           │
│  Firebase Cloud Functions (Node.js 20)                       │
│  → Trigger: mailQueue/{id} → Nodemailer → Gmail SMTP         │
└─────────────────────────────────────────────────────────────┘
```

### Patrones de Diseño Implementados

| Patrón | Implementación |
|--------|---------------|
| **Context + Local State** | Estado global `workspace` + `ThemeContext` |
| **Optimistic Updates** | Cambios locales inmediatos, sync en background |
| **Factory Pattern** | Funciones criadoras de entidades tipadas |
| **Observer** | Auditoría y notificaciones automáticas en cada mutación |
| **Repository** | Abstracción de almacenamiento dual local/cloud |
| **Role-Based Access** | Vistas y acciones filtradas por `activeRole` |

### Flujo de Mutación de Estado

```
Acción del usuario
    ↓
  mutate()
    ├── Actualiza workspace state
    ├── Crea entrada de auditoría
    ├── Añade trabajo a cola de sync
    ├── Encola correo (si aplica)
    ├── Emite notificación local
    └── Guarda en AsyncStorage (debounce 300ms)
         └── Sincroniza con Firestore (si configurado)
```

---

##  Modelo de Datos

### Entidades Principales

```typescript
// Pedido de mueble (entidad raíz)
FurnitureOrder {
  id, reference (#1, #2...),
  client: { name, email, phone, city },
  furnitureName, material, size, needsCushions,
  estimatedCost, dueDate, notes, tags[],
  status: 'pending_approval' | 'approved' | 'in_progress' | 'blocked' | 'completed',
  priority: 'Alta' | 'Media' | 'Baja',
  pricing: { productionCost, finalPrice, expectedMargin, adminNote },
  stages: WorkflowStage[],
  events: OrderEvent[]
}

// Etapa del flujo de trabajo
WorkflowStage {
  id, title, role, assigneeId,
  status: 'pending' | 'active' | 'completed' | 'blocked',
  payout, payoutRule, note,
  startedAt?, completedAt?, paidAt?
}

// Empleado
Employee {
  id, name, role, email, phone, avatarUri?,
  accent, baseRate, availability,
  specialties[], performance (0-100),
  paymentMethods[], paymentAccounts{}
}

// Notificación
AppNotification {
  id, title, body, priority,
  channels[], recipients[], orderId?,
  read, actionLabel?, createdAt
}
```

### Entidades Operativas

```typescript
SyncJob     → Cola de sincronización con Firestore
MailQueueItem → Cola de correos electrónicos pendientes
AuditEntry  → Registro de auditoría de todas las acciones
SystemHealth → Estado de salud del sistema (healthy/warning/critical)
```

### Diagrama Entidad-Relación

```
Employee (1) ──────< WorkflowStage (N) >────── FurnitureOrder (1)
    │                                                │
    │                                                ├── OrderEvent (N)
    │                                                ├── SyncJob (N)
    │                                                └── MailQueueItem (N)
    │
    └──────< AppNotification (N) (vía recipients[])

WorkspaceState (singleton)
    ├── employees[]
    ├── orders[]
    ├── notifications[]
    ├── syncQueue[]
    ├── mailQueue[]
    ├── auditLog[]
    └── notificationSettings
```

---

## 👤 Roles y Permisos

La aplicación implementa un sistema de **7 roles** que determinan la visibilidad y las acciones disponibles:

| Rol | Color | Responsabilidades | Tarifa Base |
|-----|-------|-------------------|-------------|
| 🟠 **Comercial** | Ámbar | Captura de solicitudes, relación con cliente | $30,000 |
| 🟢 **Administración** | Teal | Aprobación, precios, asignaciones, pagos | $45,000 |
| 🔵 **Diseño** | Azul | Planos y diseños técnicos | $60,000 |
| 🟤 **Carpintería** | Marrón | Estructura y ensamblaje | $120,000 |
| 🟣 **Tapicería** | Púrpura | Tapizado y acabados textiles | $95,000 |
| ⚪ **Calidad** | Slate | Control de calidad pre-entrega | $50,000 |
| ⚫ **Despacho** | Dark Slate | Logística y entrega final | $40,000 |

### Permisos por Rol

| Acción | Comercial | Admin | Diseño | Carpintería | Tapicería | Calidad | Despacho |
|--------|:---------:|:-----:|:------:|:-----------:|:---------:|:-------:|:--------:|
| Crear solicitud | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Aprobar pedido | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Editar precios | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Reasignar etapas | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Marcar pagos | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Iniciar su etapa | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Completar su etapa | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver pagos propios | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Generar PDF | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 🔄 Flujo de Trabajo de un Pedido

```
 ┌──────────────────┐
 │  1. SOLICITUD     │  Comercial crea el pedido
 │  (auto-completada)│  → Se genera referencia #N
 └────────┬─────────┘  → Se asigna a admin para aprobación
          │
 ┌────────▼─────────┐
 │  2. VALIDACIÓN    │  Admin revisa, aprueba, ajusta precios
 │  ADMINISTRATIVA   │  → Define margen y costo de producción
 └────────┬─────────┘  → Configura responsables y pagos
          │
 ┌────────▼─────────┐
 │  3. DISEÑO        │  Diseñador crea planos técnicos
 │  TÉCNICO          │  → Inicia etapa → Completa etapa
 └────────┬─────────┘  → Se desbloquea automáticamente la siguiente
          │
 ┌────────▼─────────┐
 │  4. CARPINTERÍA   │  Carpintero construye estructura
 │                   │  → Seguimiento de tiempo
 └────────┬─────────┘
          │
 ┌────────▼─────────┐
 │  5. TAPICERÍA     │  Tapicero realiza acabados textiles
 │  (si aplica)      │  → Solo si needsCushions = true
 └────────┬─────────┘
          │
 ┌────────▼─────────┐
 │  6. CONTROL DE    │  QA verifica calidad antes de enviar
 │  CALIDAD          │
 └────────┬─────────┘
          │
 ┌────────▼─────────┐
 │  7. DESPACHO      │  Logística coordina y entrega
 │                   │  → Pedido pasa a 'completed'
 └──────────────────┘  → Notificación a todo el equipo
```

### Cálculo Automático de Prioridad

| Días restantes | Prioridad | Color |
|:--------------:|:---------:|:-----:|
| ≤ 4 días | 🔴 Alta | Rojo |
| 5 – 10 días | 🟠 Media | Naranja |
| ≥ 11 días | 🟢 Baja | Verde |

### Cálculo de Precios

```
Precio final     = Costo estimado × 1.45 (margen del 45%)
Costo producción = Costo estimado (ingresado por comercial)
Margen esperado  = Precio final − Costo producción
```

---

##  Estructura del Proyecto

```
app-movil/
├── App.tsx                          # Componente principal (UI + lógica + estado)
├── index.ts                         # Entry point Expo
├── app.json                         # Configuración Expo (nombre, iconos, plugins)
├── package.json                     # Dependencias y scripts
├── tsconfig.json                    # TypeScript strict mode
├── firebase.json                    # Configuración Firebase CLI
├── firestore.rules                  # Reglas de seguridad Firestore
├── firestore.indexes.json           # Índices compuestos Firestore
├── .env                             # Variables de entorno (no versionado)
├── .env.example                     # Plantilla de variables de entorno
├── .gitignore                       # Archivos excluidos del repositorio
│
├── src/
│   ├── types.ts                     # Definiciones TypeScript de todo el sistema
│   │
│   ├── constants/
│   │   ├── theme.ts                 # Temas oscuro/claro, colores por rol y estado
│   │   └── improvements.ts          # Catálogo de 250 mejoras categorizadas
│   │
│   ├── data/
│   │   └── seed.ts                  # Datos iniciales: 7 empleados, 3 pedidos demo
│   │
│   ├── services/
│   │   ├── firebase.ts              # Conexión Firestore, load/save workspace
│   │   ├── notifications.ts         # Push local (Expo) + Web Notifications API
│   │   ├── pdf.ts                   # HTML→PDF, compartir, componer email
│   │   └── repository.ts            # Persistencia dual AsyncStorage + Firestore
│   │
│   └── utils/
│       ├── backend.ts               # uid(), factories de sync/audit/mail, salud
│       ├── format.ts                # Moneda COP, fechas, etiquetas de estado
│       └── order.ts                 # Blueprints, builder, progreso, estado derivado
│
├── firebase/
│   └── functions/
│       ├── index.js                 # Cloud Function: auto-email en mailQueue
│       └── package.json             # Dependencias: firebase-admin, nodemailer
│
├── scripts/
│   ├── generate_docx.py             # Generador de documentación Word
│   └── serve-web.ps1                # Script para servir build web
│
├── docs/
│   ├── documentacion.md             # Documentación funcional
│   └── firebase-setup.md            # Guía de configuración Firebase
│
└── assets/
    ├── icon.png                     # Icono de la app
    ├── splash-icon.png              # Pantalla de carga
    ├── favicon.png                  # Favicon web
    └── android-icon-*.png           # Iconos adaptativos Android
```

---

##  Stack Tecnológico

### Frontend

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| **Expo** | 55.0.5 | Framework React Native multiplataforma |
| **React** | 19.2.0 | Biblioteca de interfaz de usuario |
| **React Native** | 0.83.2 | Renderizado nativo iOS/Android |
| **React Native Web** | 0.21.0 | Soporte web |
| **TypeScript** | 5.9.2 | Tipado estático (modo estricto) |
| **Expo Linear Gradient** | 15.0.2 | Fondos degradados |
| **Expo Blur** | 14.1.5 | Efecto glassmorphism |
| **Expo Vector Icons** | 15.0.2 | Iconografía (Ionicons) |

### Persistencia y Backend

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| **AsyncStorage** | 2.2.0 | Almacenamiento local key-value |
| **Firebase** | 12.10.0 | SDK web para Firestore |
| **Firebase Admin** | 13.5.0 | Cloud Functions server-side |
| **Firebase Functions** | 6.5.0 | Triggers serverless |
| **Nodemailer** | 6.9.16 | Envío SMTP de correos |

### Servicios Nativos

| Tecnología | Uso |
|-----------|-----|
| **Expo Print** | Generación de PDF desde HTML |
| **Expo Sharing** | Hoja de compartir nativa |
| **Expo Mail Composer** | Composición de correo con adjuntos |
| **Expo Notifications** | Notificaciones push locales |

---

##  Instalación y Configuración

### Requisitos Previos

- **Node.js** 18+ (recomendado 20)
- **npm** 9+ o **yarn** 1.22+
- **Expo CLI**: `npx expo` (viene con el SDK)
- **Python 3.8+** (solo para generación de documentos Word)
- **Firebase CLI** (solo para despliegue de Cloud Functions)

### Pasos de Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/appmovil277-afk/APP_MOVIL.git
cd APP_MOVIL/app-movil

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con las credenciales Firebase reales

# 4. Iniciar en modo desarrollo
npm run web        # Navegador
npm run android    # Emulador Android
npm run ios        # Simulador iOS (macOS)
npm start          # Menú interactivo Expo
```

### Primer Inicio

Al iniciar por primera vez, la app carga automáticamente **datos de demostración**:
- 7 empleados con roles asignados
- 3 pedidos en diferentes estados
- Notificaciones de ejemplo

Para iniciar sesión, selecciona cualquier perfil de la pantalla de login.

---

##  Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm start` | Servidor de desarrollo Expo (menú interactivo) |
| `npm run web` | Inicia la aplicación en el navegador |
| `npm run android` | Inicia en emulador/dispositivo Android |
| `npm run ios` | Inicia en simulador iOS |
| `npm run typecheck` | Verifica tipos TypeScript sin compilar |
| `npm run export:web` | Exporta build estático para web |
| `npm run docs:word` | Genera documento Word de documentación |
| `pwsh ./scripts/serve-web.ps1` | Sirve el build web exportado |

---

##  Integración Firebase

### Colecciones Firestore

```
Firestore Root
├── employees/{employeeId}           → Employee
├── orders/{orderId}                 → FurnitureOrder
├── notifications/{notificationId}   → AppNotification
├── syncQueue/{syncId}               → SyncJob
├── mailQueue/{mailId}               → MailQueueItem
├── auditLog/{auditId}               → AuditEntry
└── settings/workspace               → NotificationSettings
```

### Índices Compuestos

| Colección | Campos | Propósito |
|-----------|--------|-----------|
| `orders` | status ↑, dueDate ↑ | Pedidos por estado y fecha límite |
| `notifications` | read ↑, createdAt ↓ | Notificaciones no leídas recientes |
| `syncQueue` | status ↑, createdAt ↓ | Trabajos pendientes de sincronización |
| `mailQueue` | status ↑, createdAt ↓ | Correos pendientes de envío |

### Reglas de Seguridad

Actualmente configuradas con acceso autenticado:
```javascript
allow read, write: if request.auth != null;
```

### Activar Firebase

1. Copia `.env.example` → `.env`
2. Rellena las 6 variables `EXPO_PUBLIC_FIREBASE_*`
3. Despliega reglas e índices: `firebase deploy --only firestore`
4. Despliega funciones: `firebase deploy --only functions`

---

##  Cloud Functions

### `mailQueueCreated`

Trigger automático que se ejecuta cuando se crea un documento en `mailQueue/`:

```
Nuevo documento en mailQueue
    ↓
Cloud Function se activa
    ↓
Crea transporter Nodemailer (Gmail SMTP)
    ↓
Envía email HTML con diseño TallerFlow
    ↓
Actualiza estado: 'sent' o 'failed'
    ↓
Registra resultado en mailQueueLogs
```

**Configuración SMTP** via Firebase params:
- `SMTP_USER`: Dirección de correo remitente
- `SMTP_PASS`: Contraseña de aplicación Gmail

---

##  Generación de PDF y Correos

### PDF

La app genera documentos PDF profesionales con:
- Sección hero: referencia, nombre del mueble, datos del cliente
- Especificaciones: material, tamaño, almohadas, notas
- Costos: producción, precio final, margen esperado
- Tabla de flujo de trabajo: etapas, roles, responsables, pagos

### Envío de Correo

| Plataforma | Método |
|-----------|--------|
| **iOS/Android** | `MailComposer.composeAsync()` con adjunto PDF |
| **Web** | `mailto:` con asunto y cuerpo pre-formateado |
| **Backend** | Cloud Function + Nodemailer (automático) |

---

## Sistema de Notificaciones

### Disparadores Automáticos

| Evento | Destinatarios | Prioridad |
|--------|--------------|-----------|
| Pedido creado | Admin | Media |
| Pedido aprobado | Equipo completo | Alta |
| Etapa iniciada | Admin + responsable | Media |
| Etapa completada | Admin + siguiente responsable | Media |
| Pedido completado | Equipo completo | Alta |

### Canales

- **In-app**: Centro de notificaciones integrado
- **Push**: Expo Notifications (móvil) / Web Notifications API
- **Email**: Via MailComposer o Cloud Functions
- **WhatsApp**: Preparado (no implementado)

---

##  Persistencia y Sincronización

### Estrategia Local-First

```
1. Lectura  → Siempre desde estado local (workspace)
2. Escritura → AsyncStorage inmediato (debounce 300ms)
3. Sync     → Firestore en background (si configurado)
4. Fallback → Si Firebase no disponible, funciona 100% offline
```

### Estado de Salud del Sistema

| Indicador | Healthy | Warning | Critical |
|-----------|:-------:|:-------:|:--------:|
| Cola sync | ≤ 3 | 4–8 | > 8 |
| Correos pendientes | ≤ 3 | > 3 | — |
| Pedidos vencidos | 0 | 1–2 | > 2 |

---

##  Sistema de Diseño (UI/UX)

### Tema Oscuro (por defecto)

Inspirado en aurora boreal con glassmorphism:
- **Primario**: Teal `#5ce1ff`
- **Fondos**: Navy gradientes `#030712` → `#0a1528`
- **Acentos glow**: Azul, Rosa, Mint, Índigo, Ámbar
- **Vidrio**: Overlays semi-transparentes con desenfoque

### Tema Claro

- **Primario**: Teal `#127ea2`
- **Fondos**: Blancos y azules claros
- **Texto**: Dark ink `#102038`

### Componentes UI Reutilizables

| Componente | Descripción |
|-----------|-------------|
| `Stat` | Tarjeta KPI con etiqueta y valor |
| `Chip` | Badge con gradiente toggle |
| `Panel` | Contenedor con título y efecto vidrio |
| `Field` | Input con etiqueta estilizada |
| `Tag` | Etiqueta inline pequeña |
| `Quick` | Botón ghost compacto |
| `AvatarNode` | Círculo con iniciales + color de estado |
| `StyledPicker` | Dropdown con borde teal |
| `SettingCard` | Toggle con descripción |
| `BottomTabBar` | Barra de navegación estilo iPhone |

---

## 🚀 Catálogo de Mejoras

La app incluye un catálogo de **250 mejoras** organizadas en **10 categorías**:

1. **Captura comercial** (25) — Formulario, validación, autocompletado
2. **Orquestación administrativa** (25) — Aprobación, precios, asignaciones
3. **Ejecución de producción** (25) — Flujo secuencial, tracking
4. **Calidad y logística** (25) — QA, fotos, firma, entrega
5. **Notificaciones y alertas** (25) — Multicanal, SLA, escalamiento
6. **Cliente y documentos** (25) — PDF, email, plantillas
7. **Analítica y control** (25) — KPIs, métricas, exportación
8. **UX y diseño** (25) — Glassmorphism, accesibilidad
9. **Seguridad y datos** (25) — Auditoría, cifrado, roles
10. **Firebase y colaboración** (25) — Sync, multi-usuario, cloud

---

##  Variables de Entorno

Crear un archivo `.env` en la raíz del proyecto:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=tu-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
```

>  **Importante**: El archivo `.env` está en `.gitignore` y no se sube al repositorio. Sin estas variables, la app funciona en modo local.

---

##  Despliegue

### Web (Expo Export)

```bash
npm run export:web
# Genera archivos estáticos en dist/
# Servir con cualquier servidor web estático
```

### Android/iOS (EAS Build)

```bash
npx eas build --platform android
npx eas build --platform ios
```

### Firebase

```bash
firebase login
firebase deploy --only firestore    # Reglas e índices
firebase deploy --only functions    # Cloud Functions
```

---

##  Contribución

1. Crea un fork del repositorio
2. Crea una rama feature: `git checkout -b feature/nueva-funcionalidad`
3. Haz commit de tus cambios: `git commit -m "Agrega nueva funcionalidad"`
4. Push a la rama: `git push origin feature/nueva-funcionalidad`
5. Abre un Pull Request

---
