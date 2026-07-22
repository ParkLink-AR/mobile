# ParkLink Mobile — Diseño

## Contexto

Repositorio principal de la app móvil de ParkLink (TP Profesional, Grupo 14 Piñeiro/Perrotta). Objetivo: tener una app corriendo en local para el jueves 2026-07-16, con el flujo completo mockeado (sin conexión real al API Gateway/backend).

## Stack

- **React Native + Expo (managed workflow)** — confirmado como el mismo React Native que ya define el anteproyecto (sección 10.1), con el toolchain de Expo encima para no depender de configurar Xcode/Android Studio a mano.
- **TypeScript**.
- **Expo Router** (ruteo por archivos) en vez de armar React Navigation a mano — con ~22 pantallas, ahorra boilerplate y mapea bien los dos tab bars (conductor de 3 pestañas, propietario de 4).
- **Zustand** para estado global mínimo (usuario mock activo + rol).
- Corre en local con `npx expo run:ios` / `npx expo run:android` (simulador/emulador en la Mac, sin celular ni cuenta de Expo requeridos) o `npx expo start` + Expo Go como alternativa.
- Escala a producción vía `npx expo prebuild` cuando haga falta código nativo custom — no hay techo ni migración forzada.

## Paleta (Anexo 2 del anteproyecto, no la del wireframe)

- Deep Navy `#042347` — headers, tab bar activo, texto principal.
- Modern Teal `#168B8D` — CTAs y acentos interactivos.
- Blanco `#FFFFFF` — fondos.
- Verde/ámbar semánticos (no definidos en la guía de marca, agregados por necesidad funcional) — badges de estado CONFIRMADA/PENDIENTE.

## Mocks (clave para no tirar trabajo cuando se conecte el backend real)

`src/services/` — un archivo por microservicio (`authService.ts`, `parkingService.ts`, `bookingService.ts`, `paymentService.ts`), cada uno exponiendo funciones con el mismo nombre y forma que los endpoints reales ya definidos (`searchParkingSpots()`, `getParkingSpotDetail(id)`, `createBooking()`, etc.). Por dentro, devuelven datos hardcodeados de `src/mocks/` con un delay artificial. El día que se conecte al API Gateway real, se reemplaza el cuerpo de cada función — ninguna pantalla cambia.

Login sin backend real: pantalla `mode-select` para elegir "Entrar como Conductor" / "Entrar como Propietario" (usuarios mock), sin presuponer cómo se resuelve el tema de roles en auth-service.

## Inventario de pantallas (22, cubren los ~30 casos de uso)

**Cuenta** (sin mockup real): selector de modo demo, login, registro, recuperar contraseña, ver perfil, editar perfil.

**Conductor** (con mockup real: búsqueda, detalle, confirmar reserva): buscar en mapa, detalle de cochera, confirmar reserva + pago, reserva confirmada (éxito), historial de reservas, detalle de una reserva, calificar al propietario.

**Propietario** (con mockup real: publicar, panel): mis cocheras, publicar cochera, panel/inicio, reservas recibidas, gestionar disponibilidad, liquidaciones, detalle de liquidación, calificar al conductor (reutiliza el componente del conductor).

Casos de uso sin pantalla propia: "ver reputación" se integra como sección del detalle de cochera/perfil; "recibir notificación" se simula con un toast/banner in-app.

## Estructura de carpetas

```
mobile/
  app/                    ← rutas (Expo Router)
    (auth)/...
    (driver)/             ← tabs: Buscar / Reservas / Perfil
    (owner)/              ← tabs: Inicio / Mis cocheras / Reservas / Perfil
    profile/...
    mode-select.tsx
  src/
    theme/                ← colors.ts, typography.ts
    services/             ← 1 archivo por microservicio, misma forma que los endpoints reales
    mocks/                ← fixtures hardcodeados
    store/                ← useSessionStore.ts (zustand)
    components/           ← Button, Chip, Card, StatusBadge, RatingStars
    types/                ← interfaces espejo de los DTOs del backend
```

## Fuera de alcance de esta primera pasada

- Conexión real al API Gateway.
- Publicación en stores (solo simulador/emulador local).
- Notificaciones push reales (FCM) — se simulan con un toast in-app.
- Subida real de fotos a Object Storage — placeholder de UI únicamente.
