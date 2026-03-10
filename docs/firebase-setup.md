# Guía Firebase

## Estado actual

La app ya está conectada a una capa Firebase configurable, pero no quedó enlazada a un proyecto real porque este entorno no pudo completar el login OAuth de Google/Firebase Console.

## Archivos listos

- `.env.example`
- `src/services/firebase.ts`
- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`
- `firebase/functions/index.js`

## Pasos para conexión real

1. Inicia sesión con Firebase CLI desde un entorno con navegador:
   `firebase login`
2. Crea o selecciona el proyecto:
   `firebase use --add`
3. Obtén el `firebaseConfig` del proyecto web.
4. Llena `.env` con las variables `EXPO_PUBLIC_FIREBASE_*`.
5. Despliega reglas e índices:
   `firebase deploy --only firestore`
6. Despliega funciones:
   `firebase deploy --only functions`

## Base de datos sugerida

- `employees`
- `orders`
- `notifications`
- `settings/workspace`
- `mailQueue`

## Correo automático

La función incluida deja trazas de la cola `mailQueue`. Para correo real puedes ampliarla con Resend, SendGrid o la extensión oficial de Firebase `firestore-send-email`.

