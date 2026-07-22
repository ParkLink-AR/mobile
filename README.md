# ParkLink Mobile

App móvil de ParkLink (Trabajo Profesional, Grupo 14 Piñeiro/Perrotta) — React Native + Expo, con todo el flujo de conductor y propietario **mockeado** (sin backend real conectado). Ver el diseño completo en `docs/superpowers/specs/` y el plan de implementación en `docs/superpowers/plans/`.

## Requisitos previos

- **macOS** (para el Simulador de iOS) — en Linux/Windows podés usar la Opción B (navegador) o C (celular real) igual.
- **Node.js 20.19+, 22.13+ o 24.3+** (Expo SDK 57 lo pide explícitamente; versiones más nuevas como 23.x también andan, solo tiran warnings `EBADENGINE` que se pueden ignorar).
- **Git**.
- **Xcode** (solo si querés usar el Simulador de iOS en tu Mac — no hace falta para las otras dos opciones de abajo).

## 1. Instalar Node.js

Recomendado vía [nvm](https://github.com/nvm-sh/nvm) para no pisar otras versiones que tengas instaladas:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nvm install 22
nvm use 22
node -v
npm -v
```

## 2. Clonar el proyecto

```bash
git clone <URL-del-repo> parklink-mobile
cd parklink-mobile
```

## 3. Instalar dependencias

```bash
npm install --legacy-peer-deps
```

> El flag `--legacy-peer-deps` es necesario: `expo-router` trae de forma opcional soporte web vía `@expo/ui`/Radix UI, que tiene un conflicto de peer dependencies con `react-dom` que no afecta a la app (no usamos esas features web). Sin el flag, `npm install` falla con un error `ERESOLVE`.

## 4. Verificar que todo esté bien

```bash
npm test          # deberían pasar 8 tests (parkingService, bookingService, useSessionStore)
npx tsc --noEmit  # chequeo de tipos, no debería tirar errores
```

## 5. Levantar la app

Hay tres formas, de más simple a más "real". No hace falta hacer las tres — elegí una.

### Opción A: navegador (la más rápida, no instala nada más)

```bash
npx expo start --web
```

Abre `http://localhost:8081` (o el puerto que indique la consola) en tu navegador. Para verlo con proporciones de celular, activá el modo de emulación de dispositivo del navegador (en Chrome: `Cmd+Shift+M` / `Ctrl+Shift+M`, y elegí un iPhone en el desplegable).

### Opción B: Simulador de iOS (requiere Xcode)

1. Instalá **Xcode** desde la App Store (pesado, puede tardar un buen rato).
2. Apuntá las herramientas de desarrollo al Xcode completo (no a las Command Line Tools sueltas):
   ```bash
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   ```
3. Descargá un runtime de simulador si no tenés ninguno:
   ```bash
   xcodebuild -downloadPlatform iOS
   ```
   (o desde la interfaz: Xcode → Settings → Platforms → `+`).
4. Confirmá que hay al menos un dispositivo disponible:
   ```bash
   xcrun simctl list devices available
   ```
5. Levantá la app:
   ```bash
   npx expo start --ios
   ```
   Esto abre el Simulador, instala Expo Go automáticamente la primera vez, y carga el proyecto.

### Opción C: celular real con Expo Go

1. Instalá la app **Expo Go** en tu celular (App Store / Play Store).
2. Levantá el servidor:
   ```bash
   npx expo start
   ```
3. Escaneá el código QR que aparece en la terminal con la cámara (iOS) o con Expo Go (Android). Tu celu y tu computadora tienen que estar en la **misma red WiFi**.
   - Si Expo Go no conecta (redes corporativas con aislamiento de dispositivos suelen bloquear esto), buscá la opción **"Enter URL manually"** dentro de Expo Go e ingresá `exp://<IP-de-tu-compu>:8081` (conseguís la IP con `ipconfig getifaddr en0` en Mac).

## Credenciales de prueba

No hay backend real — el login acepta cualquier valor, pero estos dos emails eligen el rol:

| Email | Entra como |
|---|---|
| `conductor@gmail.com` | Conductor |
| `propietario@gmail.com` | Propietario |

La contraseña no se valida, podés poner cualquier cosa.

## Estructura del proyecto

```
app/                    ← rutas (Expo Router)
  (auth)/                 login, registro, recuperar contraseña
  (driver)/                buscar, detalle, reservar, pagar, historial
  (owner)/                  publicar cochera, panel, liquidaciones
src/
  theme/                  colores y tipografía
  types/                  tipos compartidos (mirror de los DTOs del backend)
  mocks/                  datos hardcodeados (cocheras, reservas, reseñas, métodos de pago)
  services/               capa de mocks — misma forma que los endpoints reales del backend
  store/                  estado global (Zustand)
  components/             componentes compartidos (Button, Card, Chip, etc.)
```

## Problemas comunes

- **`ERESOLVE` al instalar** → agregá `--legacy-peer-deps` al comando (ver paso 3).
- **Warnings `EBADENGINE`** → Node no coincide exactamente con lo que pide Expo. No son fatales, se puede seguir igual; si molestan, instalá Node 22 con `nvm`.
- **`Unable to run simctl`** → Xcode no está apuntado correctamente. Corré el paso 2 de la Opción B.
- **`xcrun simctl list devices available` no muestra nada** → falta descargar un runtime, correr el paso 3 de la Opción B.
- **Expo Go se queda "conectando..." sin avanzar** → probablemente aislamiento de dispositivos en la red WiFi. Probá con `exp://localhost:8081` si estás en el mismo Mac que corre el simulador, o cambiá de red.
- **403 al instalar paquetes** → si estás en una red corporativa con un registro de npm interno, puede que el paquete no esté permitido ahí. Probá desde otra red, o pedí que se habilite en el registro interno.
