#!/usr/bin/env bash
#
# Prueba local (gratis) de una push notification en un simulador/emulador ya
# abierto, sin pasar por FCM ni APNs. Simula el payload que manda el backend
# (notifications-service/app/services/push.py).
#
#   ./scripts/push-sim.sh ios  pending      # push del propietario en iOS Simulator
#   ./scripts/push-sim.sh ios  confirmed    # push del conductor en iOS Simulator
#   ./scripts/push-sim.sh android pending   # idem en el emulador Android
#
# iOS  -> xcrun simctl push   (requiere macOS + un simulador booteado)
# Android -> el emulador no acepta push simuladas; se usa una notificación local
#            equivalente vía `adb shell cmd notification post` (aproximación).
#
# NO valida: registro del token, el envío del backend, FCM ni APNs. Sólo que la
# app muestre la notificación y que el tap navegue bien.
set -euo pipefail

PLATFORM="${1:-}"
KIND="${2:-pending}"
BUNDLE="com.parklink.mobile"
BOOKING_ID="sim-test-123"

case "$KIND" in
  pending)
    TITLE="🔔 Tenés una reserva para confirmar"
    BODY="Alguien reservó y pagó Cochera de Beto para el 5 de octubre de 15:00 a 18:00. Aceptá o rechazá la reserva desde la app antes del 6 de octubre a las 19:37."
    TYPE="booking.pending_approval"
    ;;
  confirmed)
    TITLE="✅ ¡Reserva confirmada!"
    BODY="Tu lugar en Cochera de Beto para el 5 de octubre de 15:00 a 18:00 ya está confirmado. ¡Buen viaje! 🚗"
    TYPE="booking.confirmed"
    ;;
  *) echo "kind inválido: usá 'pending' o 'confirmed'"; exit 1;;
esac

case "$PLATFORM" in
  ios)
    TMP="$(mktemp -t parklink-push.XXXXXX)"
    cat > "$TMP" <<JSON
{
  "Simulator Target Bundle": "$BUNDLE",
  "aps": { "alert": { "title": "$TITLE", "body": "$BODY" }, "sound": "default" },
  "type": "$TYPE",
  "bookingId": "$BOOKING_ID"
}
JSON
    xcrun simctl push booted "$BUNDLE" "$TMP"
    rm -f "$TMP"
    echo "→ push '$TYPE' enviada al simulador iOS booteado."
    ;;
  android)
    adb shell cmd notification post -S bigtext -t "$TITLE" "parklink-$KIND" "$BODY" >/dev/null
    echo "→ notificación local '$KIND' posteada en el emulador Android."
    echo "  (para probar el pipeline real de FCM en Android, usá el flujo del backend)"
    ;;
  *)
    echo "uso: $0 ios|android pending|confirmed"; exit 1;;
esac
