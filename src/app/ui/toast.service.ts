import { Injectable, signal } from '@angular/core';

export interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}
export interface ToastState {
  text: string;
  tone: 'ink' | 'danger';
  action?: ToastAction;
}

/** A 1 KB replacement for ion-toast (which alone was 23 KB of the first download). */
@Injectable({ providedIn: 'root' })
export class Toast {
  readonly current = signal<ToastState | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  show(text: string, opts: { ms?: number; tone?: ToastState['tone']; action?: ToastAction } = {}): void {
    clearTimeout(this.timer);
    this.current.set({ text, tone: opts.tone ?? 'ink', action: opts.action });
    this.timer = setTimeout(() => this.current.set(null), opts.ms ?? 2800);
  }

  error(text: string): void {
    this.show(text, { tone: 'danger', ms: 3500 });
  }

  async act(): Promise<void> {
    const a = this.current()?.action;
    clearTimeout(this.timer);
    this.current.set(null);
    await a?.run();
  }
}
