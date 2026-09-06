import prisma from "../../prisma/client";

// Per-account lockout, alongside the per-IP rate limit rather than instead of
// it. The two catch different things: the IP limit stops one machine hammering
// the endpoint, but a whole counselling office shares one connection, so it
// cannot be tightened far without locking out colleagues. This one follows the
// account, so an attempt spread across many addresses at a single email is
// caught, and a busy office is not.
const THRESHOLD = 8;

// Escalating, so a genuine mistyped-password run costs a short pause while a
// sustained attempt becomes expensive. Capped so an account is never locked
// indefinitely by someone else's behaviour — that would turn this control into
// a way of denying a counsellor access to their own couples.
const LOCK_STEPS_MINUTES = [15, 60, 240];
const MAX_LOCK_MINUTES = 240;

export type LockState = { locked: true; until: Date } | { locked: false };

class LoginAttemptsService {
  lockState(user: { lockedUntil: Date | null } | null): LockState {
    if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      return { locked: true, until: user.lockedUntil };
    }
    return { locked: false };
  }

  async recordFailure(userId: string, currentAttempts: number) {
    const attempts = currentAttempts + 1;

    if (attempts < THRESHOLD) {
      await prisma.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: attempts },
      });
      return { locked: false as const, attempts };
    }

    // Which step of the escalation this is: the first lock after THRESHOLD
    // failures, the second after another THRESHOLD, and so on.
    const step = Math.floor(attempts / THRESHOLD) - 1;
    const minutes =
      LOCK_STEPS_MINUTES[Math.min(step, LOCK_STEPS_MINUTES.length - 1)] ??
      MAX_LOCK_MINUTES;
    const until = new Date(Date.now() + minutes * 60 * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: attempts, lockedUntil: until },
    });

    return { locked: true as const, attempts, until, minutes };
  }

  // Called on a successful sign-in. Leaving the counter standing would mean a
  // few scattered typos over months eventually locked a legitimate account.
  async clear(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }
}

export default new LoginAttemptsService();
