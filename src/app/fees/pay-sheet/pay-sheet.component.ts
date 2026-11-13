import type { OnInit } from '@angular/core';
import { Component, Input, computed, inject, signal } from '@angular/core';
import { ModalController } from '@ionic/angular';

import { money } from '../../core/format';
import { L, T } from '../../core/i18n';
import type { Mode, Row } from '../fees.models';

/** Bottom sheet: pick how much was received and how, then one big green button. Defaults to paying everything. */
@Component({
  selector: 'app-pay-sheet',
  templateUrl: './pay-sheet.component.html',
  styleUrls: ['./pay-sheet.component.scss'],
})
export class PaySheetComponent implements OnInit {
  @Input({ required: true }) row!: Row; // set by ModalController via componentProps

  private readonly modal = inject(ModalController);

  readonly t = computed(() => T[L()]);
  readonly money = money;
  readonly amount = signal(0);
  readonly mode = signal<Mode>('cash');
  readonly custom = signal(false);

  ngOnInit(): void {
    this.amount.set(this.row.balance);
  }

  pick(steps: number): void {
    this.amount.set(steps);
    this.custom.set(false);
  }

  setCustom(e: Event): void {
    this.amount.set(Math.round(+(e.target as HTMLInputElement).value * 100));
  }

  ok(): void {
    if (this.amount() > 0) {
      void this.modal.dismiss({ amount: Math.round(this.amount()), mode: this.mode() });
    }
  }
}
