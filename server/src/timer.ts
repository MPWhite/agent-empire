export class TurnTimer {
  private timerId: ReturnType<typeof setInterval> | null = null;
  private endTime = 0;
  private readonly durationMs: number;
  private readonly onTick: (secondsRemaining: number) => void;
  private readonly onExpire: () => void;

  constructor(opts: {
    durationSeconds: number;
    onTick: (secondsRemaining: number) => void;
    onExpire: () => void;
  }) {
    this.durationMs = opts.durationSeconds * 1000;
    this.onTick = opts.onTick;
    this.onExpire = opts.onExpire;
  }

  start(): void {
    this.stop();
    this.endTime = Date.now() + this.durationMs;

    this.timerId = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((this.endTime - Date.now()) / 1000));
      this.onTick(remaining);

      if (remaining <= 0) {
        this.stop();
        this.onExpire();
      }
    }, 1000);
  }

  stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  getSecondsRemaining(): number {
    return Math.max(0, Math.ceil((this.endTime - Date.now()) / 1000));
  }

  getEndTime(): number {
    return this.endTime;
  }
}
