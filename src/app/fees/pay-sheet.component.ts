import type { OnInit } from '@angular/core';
import { Component, Input, inject } from '@angular/core';
import { ModalController } from '@ionic/angular';

import type { Mode, Row } from './fees.models';
import { money } from './fees.models';

@Component({
  selector: 'app-pay-sheet',
  templateUrl: 'pay-sheet.component.html',
  styleUrls: ['pay-sheet.component.scss'],
})
export class PaySheetComponent implements OnInit {
  @Input() row!: Row;
  @Input() t!: Record<string, string>;
  // NB: never name this `modal` — Ionic reserves that property on components shown inside ion-modal.
  private modalCtrl = inject(ModalController);
  amount = 0;
  mode: Mode = 'cash';
  custom = false;
  m = money;

  ngOnInit(): void {
    this.amount = this.row.balance; // default = pay everything: 2 taps total
  }

  setCustom(e: Event): void {
    this.amount = +(e.target as HTMLInputElement).value * 100;
  }

  ok(): void {
    if (this.amount > 0) this.modalCtrl.dismiss({ amount: Math.round(this.amount), mode: this.mode });
  }
}
