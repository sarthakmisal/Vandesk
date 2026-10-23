import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Mode, Row, money } from './fees.models';

@Component({
  selector: 'app-pay-sheet', standalone: false,
  template: `
  <div class="ps">
    <div class="who">{{ row.name }}<small>{{ row.months }} {{ t['months'] }}</small></div>
    <div class="amt">{{ m(amount) }}</div>
    <div class="chips">
      <button *ngFor="let s of row.steps; let i = index" [class.on]="!custom && amount === s" (click)="amount = s; custom = false">
        {{ i === row.steps.length - 1 ? t['all'] : i + 1 }}<b>{{ m(s) }}</b></button>
    </div>
    <button class="lnk" *ngIf="!custom" (click)="custom = true">{{ t['other'] }}</button>
    <input *ngIf="custom" type="number" inputmode="numeric" min="1" placeholder="₹" (input)="amount = +$any($event.target).value * 100" />
    <div class="mode">
      <button [class.on]="mode === 'cash'" (click)="mode = 'cash'">💵 {{ t['cash'] }}</button>
      <button [class.on]="mode === 'upi'" (click)="mode = 'upi'">📱 {{ t['upi'] }}</button>
    </div>
    <button class="go" [disabled]="!(amount > 0)" (click)="ok()">✓ {{ t['received'] }} {{ m(amount) }}</button>
  </div>`,
  styles: [`
  .ps{padding:22px 20px calc(22px + env(safe-area-inset-bottom,0px));background:#fff;height:100%}
  .who{font-size:20px;font-weight:800;color:#0f172a;small{display:block;color:#94a3b8;font-size:13px;font-weight:500}}
  .amt{font-size:48px;font-weight:800;letter-spacing:-.03em;margin:10px 0 14px;color:#4f46e5}
  .chips{display:flex;gap:8px;flex-wrap:wrap}.chips button{flex:1;min-width:84px;border:2px solid #e6e8f5;background:#fff;border-radius:16px;padding:10px 6px;font-weight:700;font-size:15px;color:#475569;b{display:block;font-size:14px;color:#0f172a}}
  .chips button.on,.mode button.on{border-color:#4f46e5;background:#eef0ff;color:#4f46e5}
  .lnk{border:0;background:none;color:#4f46e5;font-weight:700;margin:12px 0 0;padding:8px 0}
  input{width:100%;margin-top:12px;border:2px solid #e6e8f5;border-radius:14px;padding:14px;font-size:20px;font-weight:700}
  .mode{display:flex;gap:10px;margin:16px 0}.mode button{flex:1;border:2px solid #e6e8f5;background:#fff;border-radius:16px;padding:16px;font-size:17px;font-weight:700;color:#475569}
  .go{width:100%;border:0;border-radius:20px;padding:20px;font-size:20px;font-weight:800;color:#fff;background:linear-gradient(135deg,#10b981,#059669);box-shadow:0 14px 28px -12px rgba(5,150,105,.6)}
  .go[disabled]{opacity:.4}`],
})
export class PaySheetComponent {
  @Input() row!: Row; @Input() t!: Record<string, string>;
  amount = 0; mode: Mode = 'cash'; custom = false; m = money;
  ngOnInit() { this.amount = this.row.balance; } // default = pay everything: 2 taps total
  ok() { if (this.amount > 0) this.modal.dismiss({ amount: Math.round(this.amount), mode: this.mode }); }
  constructor(private modal: ModalController) {}
}
