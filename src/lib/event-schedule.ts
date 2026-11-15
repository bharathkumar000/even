/**
 * Event Schedule & Feature Reveal Configuration
 * 
 * Controls reveal gates for event milestones.
 * Problem statements and project deliverables are hidden until Nov 25th 2026, 10:00 AM IST.
 */

// Target reveal timestamp: November 25, 2026, 10:00:00 AM IST (+05:30)
export const DELIVERABLES_AND_PS_UNLOCK_TIME = new Date("2026-11-25T10:00:00+05:30").getTime();

/**
 * Returns true if the current time has reached or passed the reveal time.
 */
export function isDeliverablesUnlocked(): boolean {
  return Date.now() >= DELIVERABLES_AND_PS_UNLOCK_TIME;
}
