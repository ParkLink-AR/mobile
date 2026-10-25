import { useCallback } from 'react';
import { createAudioPlayer, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

const PAYMENT_APPROVED_SOUND = require('@/assets/sounds/payment-approved.wav');

/** The short chime (and a success vibration) for the moment Mercado Pago approves a
 * payment. The sound is loaded as soon as the screen mounts, so playing it is instant --
 * loading it only when the payment lands made it sound late, after the check mark was
 * already on screen. Released with the screen. Best effort: a device that can't play it
 * just skips it. Respects the phone's silent mode on iOS. */
export function usePaymentApprovedSound(): () => void {
  const player = useAudioPlayer(PAYMENT_APPROVED_SOUND);
  return useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // The screen's player was already released (a hot reload in development does it):
      // play it from a one-off player instead, released once it's done.
      try {
        const oneOff = createAudioPlayer(PAYMENT_APPROVED_SOUND);
        oneOff.play();
        setTimeout(() => oneOff.release(), 5000);
      } catch (err) {
        console.warn('[paymentSound] could not play:', err);
      }
    }
  }, [player]);
}
