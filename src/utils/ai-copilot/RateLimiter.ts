export interface RateLimitConfig {
  maxRpm: number;
  retryDelayMs: number;
  windowMs: number;
}

export interface RateLimitStatus {
  canMakeCall: boolean;
  remainingCalls: number;
  resetInMs: number;
  isInCooldown: boolean;
  cooldownRemainingMs: number;
}

export type RateLimitEvent = 'call_recorded' | 'cooldown_started' | 'cooldown_ended' | 'limit_reached';

export type RateLimitListener = (status: RateLimitStatus, event: RateLimitEvent) => void;

export class RateLimiter {
  private callTimestamps: number[] = [];
  private cooldownUntil: number | null = null;
  private config: RateLimitConfig;
  private listeners: Set<RateLimitListener> = new Set();
  private cooldownTimer: any = null;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      maxRpm: config.maxRpm ?? 28,
      retryDelayMs: config.retryDelayMs ?? 60000,
      windowMs: config.windowMs ?? 60000,
    };
  }

  canMakeCall(): boolean {
    if (this.cooldownUntil && Date.now() < this.cooldownUntil) {
      return false;
    }
    this.pruneOldCalls();
    return this.callTimestamps.length < this.config.maxRpm;
  }

  recordCall(): void {
    this.callTimestamps.push(Date.now());
  }

  async waitForSlot(): Promise<void> {
    if (this.canMakeCall()) return;
    if (this.cooldownUntil && Date.now() < this.cooldownUntil) {
      const waitMs = this.cooldownUntil - Date.now();
      await this.sleep(waitMs);
    }
    while (!this.canMakeCall()) {
      await this.sleep(1000);
    }
  }

  startCooldown(reason: string = 'rate_limit_hit'): void {
    this.cooldownUntil = Date.now() + this.config.retryDelayMs;
    this.notifyListeners({ ...this.getStatus(), isInCooldown: true }, 'cooldown_started');

    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
    }
    this.cooldownTimer = setTimeout(() => {
      this.cooldownUntil = null;
      this.cooldownTimer = null;
      this.notifyListeners(this.getStatus(), 'cooldown_ended');
    }, this.config.retryDelayMs);
  }

  isInCooldown(): boolean {
    return !!(this.cooldownUntil && Date.now() < this.cooldownUntil);
  }

  getCooldownRemainingMs(): number {
    if (!this.cooldownUntil) return 0;
    return Math.max(0, this.cooldownUntil - Date.now());
  }

  reset(): void {
    this.callTimestamps = [];
    this.cooldownUntil = null;
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    this.notifyListeners(this.getStatus(), 'limit_reached');
  }

  getStatus(): RateLimitStatus {
    this.pruneOldCalls();
    const remainingCalls = Math.max(0, this.config.maxRpm - this.callTimestamps.length);
    const oldestInWindow = this.callTimestamps[0];
    const resetInMs = oldestInWindow
      ? Math.max(0, this.config.windowMs - (Date.now() - oldestInWindow))
      : 0;

    return {
      canMakeCall: this.canMakeCall(),
      remainingCalls,
      resetInMs,
      isInCooldown: this.isInCooldown(),
      cooldownRemainingMs: this.getCooldownRemainingMs(),
    };
  }

  subscribe(listener: RateLimitListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private pruneOldCalls(): void {
    const cutoff = Date.now() - this.config.windowMs;
    this.callTimestamps = this.callTimestamps.filter((ts) => ts > cutoff);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Math.min(ms, 5000)));
  }

  private notifyListeners(status: RateLimitStatus, event: RateLimitEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(status, event);
      } catch (err) {
        console.error('RateLimiter listener error:', err);
      }
    });
  }
}

export const globalRateLimiter = new RateLimiter({
  maxRpm: 28,
  retryDelayMs: 60000,
  windowMs: 60000,
});
