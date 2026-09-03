# Push notifications (FCM)

La app registra su **token de FCM** en `notifications-service` (vía el gateway) y
`notifications-service` manda las push cuando consume `booking.confirmed` de RabbitMQ.

## Importante: requiere un *development build*

El push remoto **no funciona en Expo Go**. Hace falta un build de desarrollo:

```bash
npx expo run:android      # o run:ios
# o EAS:  eas build --profile development --platform android
```

En Expo Go / en jest, `src/services/pushNotifications.ts` detecta que
`@react-native-firebase/messaging` no está y **no hace nada** (sin romper).

## Setup de Firebase (una vez)

1. **Firebase Console → crear proyecto** ("parklink").
2. **Android**: agregar app con package `com.parklink.mobile` → descargar
   `google-services.json` → dejarlo en `mobile/google-services.json` (gitignored).
3. **iOS**: agregar app con bundle id `com.parklink.mobile` → descargar
   `GoogleService-Info.plist` → dejarlo en `mobile/GoogleService-Info.plist` (gitignored).
4. **iOS APNs**: Apple Developer → crear *APNs Auth Key* (`.p8`) → subirla en
   Firebase Console → Project Settings → Cloud Messaging → *Apple app configuration*.
5. **Backend**: el JSON de *service account* va en
   `notifications-service/secrets/firebase-service-account.json` (ver ese repo).

Sin los archivos de Firebase, `npx expo run:*` va a fallar al compilar el módulo
nativo. Para trabajar sin push, sacá temporalmente el plugin
`@react-native-firebase/app` de `app.json` y las deps `@react-native-firebase/*`.

## Qué hace la app

| Momento | Acción |
|---|---|
| Login / app en foreground con sesión | `registerForPush()`: pide permiso, obtiene el token FCM, `PUT /notifications/tokens` |
| Token rotado por FCM | `onTokenRefresh` → re-`PUT` |
| Logout | `unregisterPush()`: `DELETE /notifications/tokens/{token}` + `deleteToken()` |
| Tap en la notificación | lee `data.bookingId` → navega a `/(driver)/bookings/{id}` |

Wiring en [`app/_layout.tsx`](app/_layout.tsx); lógica en
[`src/services/pushNotifications.ts`](src/services/pushNotifications.ts) y
[`src/api/notifications.ts`](src/api/notifications.ts).
