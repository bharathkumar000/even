/**
 * Safe, cross-platform haptic feedback utility for mobile touch devices.
 * Gracefully no-ops on browsers / OSes without vibration motor access.
 */
export function triggerHaptic(pattern: number | number[] = 15) {
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Unsupported or blocked by browser permissions
    }
  }
}

/** Pre-calibrated feedback rhythms for common event interactions */
export const HapticFeedback = {
  /** Subtle crisp tick (15ms) - button tap, slider step, toggle */
  tap: () => triggerHaptic(15),
  /** Confident double pulse - successful QR scan, check-in recorded, pass verified */
  success: () => triggerHaptic([20, 50, 30]),
  /** Heavy pulse - submission officially uploaded, round published */
  confirm: () => triggerHaptic([35, 40, 35]),
  /** Double warning buzz - invalid QR, quota full, validation error */
  warning: () => triggerHaptic([50, 60, 50]),
};
