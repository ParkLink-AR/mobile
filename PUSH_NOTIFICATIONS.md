# Push notifications (FCM)

La app registra su **token de FCM** en `notifications-service` (vía el gateway).
`notifications-service` consume del bus RabbitMQ (`parklink.events`) y manda las
push:

| Evento (lo publica booking-service) | Push a | Copy |
|---|---|---|
| `booking.pending_approval` — se pagó, falta que el dueño confirme | **propietario** | "🔔 Tenés una reserva para confirmar" |
| `booking.confirmed` — el dueño aprobó, o la cochera es instant-booking | **conductor** (y al dueño si `auto_confirmed`) | "✅ ¡Reserva confirmada!" |

Los eventos son **autocontenidos** (booking-service embebe `owner_user_id`,
`driver_user_id` y `parking_spot_title`), así que notifications-service no llama
a ningún otro servicio para armar la notificación.

## Requiere un *development build* (no Expo Go)

El push remoto **no funciona en Expo Go**. Hace falta un build de desarrollo:

```bash
npx expo run:android      # o run:ios
# o EAS:  eas build --profile development --platform android
```

En jest / si `@react-native-firebase/messaging` no está,
`src/services/pushNotifications.ts` **no hace nada** (sin romper).

## Firebase — ya viene configurado

Este es un proyecto personal privado, así que las credenciales de Firebase
(proyecto `parklink-app`) están **commiteadas en el repo**:

| Archivo | Repo | Para qué |
|---|---|---|
| `mobile/google-services.json` | mobile | config de la app Android (`com.parklink.mobile`) |
| `notifications-service/secrets/firebase-service-account.json` | notifications-service | que el backend mande push por FCM |

`docker compose up` monta el JSON del backend en el contenedor y
`notifications-service` lo toma solo (ver `root/compose.yaml`). No hay que setear
nada. Para forzar log-only: `FIREBASE_CREDENTIALS_PATH=` (vacío) en el `.env`.

> ⚠️ Si el repo alguna vez se hace público, **rotá las dos credenciales**
> (Firebase Console → Service accounts → revoke/regenerate, y regenerá el
> `google-services.json`).

**iOS todavía no está configurado.** Si hace falta push en iOS:
1. Firebase Console → agregar app iOS `com.parklink.mobile` → `GoogleService-Info.plist` en `mobile/`.
2. Apple Developer → *APNs Auth Key* (`.p8`) → subirla en Firebase Console → Cloud Messaging.

## Toolchain Android para `expo run:android`

- **Android Studio + SDK** + variable `ANDROID_HOME`.
- **JDK 17** (Temurin). El JBR 25 que trae Android Studio rompe el paso de
  CMake del NDK — seteá `JAVA_HOME` a un JDK 17.
- **Emulador con Google Play** (el que tiene el ícono de Play Store) o device
  físico con depuración USB. FCM necesita Google Play Services; las imágenes
  "Google APIs" a secas no sirven.
- **Solo en Windows**: activá rutas largas (una vez, como admin) y usá un CMake
  standalone ≥ 3.30. El CMake 3.22 que trae el NDK + el límite MAX_PATH (260) de
  Windows rompen el codegen de `react-native-gesture-handler` (New Architecture).
  ```powershell
  Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' LongPathsEnabled 1 -Type DWord
  git config --global core.longpaths true
  winget install Kitware.CMake
  ```
  y en `mobile/android/local.properties` (gitignored, lo genera prebuild):
  ```
  cmake.dir=C:/Program Files/CMake
  ```
  En macOS / Linux / CI (EAS) nada de esto hace falta.

## Cómo funciona la app

| Momento | Acción |
|---|---|
| Login / foreground con sesión | `registerForPush()`: pide permiso `POST_NOTIFICATIONS`, obtiene el token FCM (API modular de `@react-native-firebase/messaging` v22+), `PUT /notifications/tokens` |
| Token rotado por FCM | `onTokenRefresh` → re-`PUT` |
| Logout | `unregisterPush()`: `DELETE /notifications/tokens/{token}` + `deleteToken()` |
| Mensaje con la app en **background/cerrada** | el SO lo muestra solo (payload `notification`), en el canal `bookings` (HIGH → heads-up), con el ícono ParkLink + teal |
| Mensaje con la app en **foreground** | `subscribeForegroundMessages` → `presentLocalNotification` lo re-presenta como notificación real del sistema vía `expo-notifications` (Android no las muestra solo) |
| Tap en la notificación | lee `data.type` + `data.bookingId` → navega a `/(driver)/bookings/{id}` (confirmed) o `/(owner)/bookings/{id}` (pending_approval) |

### Config plugins (en `app.json`, orden importa)

1. `./plugins/withFirebaseNotificationManifestFix` — **debe ir antes** de
   `expo-notifications`. Resuelve el conflicto de manifest-merge entre
   `expo-notifications` y `@react-native-firebase/messaging` sobre
   `com.google.firebase.messaging.default_notification_{color,icon}` (los mods
   de config-plugin corren en orden inverso al del array).
2. `expo-notifications` con `icon: ./assets/notification-icon.png` (marca
   ParkLink, blanca sobre transparente) y `color: #168B8D` (teal de marca).

Wiring en [`app/_layout.tsx`](app/_layout.tsx); lógica en
[`src/services/pushNotifications.ts`](src/services/pushNotifications.ts) y
[`src/api/notifications.ts`](src/api/notifications.ts).
