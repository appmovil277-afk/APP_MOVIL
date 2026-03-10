# TallerFlow Muebles

Aplicación móvil multiplataforma construida con Expo/React Native para gestionar la creación de muebles desde la solicitud comercial hasta la entrega final.

## Lo que incluye

- Formulario comercial con cliente, mueble, material, tamaño, costo y almohadas.
- Panel administrativo para aprobar, definir precio, margen, responsables, orden y pago por etapa.
- Flujo visual por roles con nodos de usuario y colores por estado.
- Barra inferior flotante estilo iPhone para la navegacion principal.
- Inicio y finalización de etapas según rol activo.
- Centro de notificaciones avanzadas con prioridades y canales.
- Generación de PDF y preparación de correo al cliente.
- Persistencia local con AsyncStorage.
- Backend operativo con cola de sincronizacion, cola de correos y auditoria.
- Capa Firebase preparada para sincronización remota cuando existan claves del proyecto.
- Catálogo integrado de 250 mejoras entre activas y preparadas.

## Comandos

```bash
npm run web
npm run typecheck
npm run export:web
npm run docs:word
pwsh ./scripts/serve-web.ps1
```

## Firebase

La app ya trae la integración preparada en `src/services/firebase.ts`, `firebase.json`, `firestore.rules` y `firestore.indexes.json`.

Para activarla:

1. Copia `.env.example` a `.env`.
2. Llena las variables `EXPO_PUBLIC_FIREBASE_*` con la configuración real del proyecto.
3. Despliega Firestore y Cloud Functions con Firebase CLI.

## Limitación actual

No fue posible completar el acceso al proyecto Firebase usando solo email y contraseña desde este terminal, porque la autenticación de Google/Firebase Console requiere flujo OAuth en navegador y puede exigir verificación adicional. Por eso dejé la integración lista para conectar apenas tengas el `firebaseConfig` del proyecto o una sesión autenticada del CLI.
