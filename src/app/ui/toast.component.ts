import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { Toast } from './toast.service';

@Component({
  selector: 'vd-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="host" role="status" aria-live="polite">
      @if (toast.current(); as c) {
        <div class="t" [class.danger]="c.tone === 'danger'">
          <span>{{ c.text }}</span>
          @if (c.action; as a) {
            <button type="button" (click)="toast.act()">{{ a.label }}</button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .host {
      position: fixed;
      right: 0;
      bottom: calc(86px + env(safe-area-inset-bottom, 0px));
      left: 0;
      z-index: 30000;
      display: flex;
      justify-content: center;
      padding: 0 16px;
      pointer-events: none;
    }
    .t {
      display: flex;
      align-items: center;
      gap: 14px;
      max-width: 420px;
      padding: 12px 16px;
      border-radius: 14px;
      background: var(--vd-ink);
      color: #fff;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 12px 32px -12px rgb(20 22 26 / 50%);
      pointer-events: auto;
      animation: in 0.2s ease;
    }
    .danger {
      background: var(--vd-danger);
    }
    button {
      color: #7fe0c8;
      font-weight: 700;
      text-transform: uppercase;
    }
    .danger button {
      color: #fff;
    }
    @keyframes in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }
  `,
})
export class ToastComponent {
  readonly toast = inject(Toast);
}
