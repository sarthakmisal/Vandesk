import { Component, Input, inject, signal } from '@angular/core';
import { IonContent, ModalController } from '@ionic/angular';

import { IconComponent } from '../../ui/icon.component';
import type { AdminRepo } from '../admin.repo';

type Field = 'name' | 'regNo' | 'capacity' | 'fee' | 'driverName' | 'driverEmail' | 'stops';

/** Onboard a bus: vehicle, driver (signs in by email), first monthly fee and, optionally, the stops in route order. */
@Component({
  selector: 'app-add-bus',
  imports: [IonContent, IconComponent],
  template: `
    <ion-content>
      <div class="vd-sheet-body">
        <h2>Add bus</h2>

        <div class="vd-grid2">
          <div>
            <label class="vd-label" for="b-name">Name</label>
            <input
              id="b-name"
              class="vd-input"
              placeholder="Van, Mini bus"
              autocomplete="off"
              (input)="set('name', $event)"
            />
          </div>
          <div>
            <label class="vd-label" for="b-reg">Registration</label>
            <input
              id="b-reg"
              class="vd-input"
              placeholder="MH-20 AB 1234"
              autocomplete="off"
              (input)="set('regNo', $event)"
            />
          </div>
          <div>
            <label class="vd-label" for="b-cap">Seats</label>
            <input
              id="b-cap"
              class="vd-input"
              type="number"
              inputmode="numeric"
              min="1"
              (input)="set('capacity', $event)"
            />
          </div>
          <div>
            <label class="vd-label" for="b-fee">Monthly fee (₹)</label>
            <input id="b-fee" class="vd-input" type="number" inputmode="numeric" min="1" (input)="set('fee', $event)" />
          </div>
        </div>

        <label class="vd-label" for="b-dn">Driver name</label>
        <input id="b-dn" class="vd-input" autocomplete="off" (input)="set('driverName', $event)" />

        <label class="vd-label" for="b-de">Driver email (he signs in with it)</label>
        <input id="b-de" class="vd-input" type="email" inputmode="email" (input)="set('driverEmail', $event)" />

        <label class="vd-label" for="b-stops">Stops, one per line, in pickup order (optional)</label>
        <textarea
          id="b-stops"
          class="vd-input"
          placeholder="Hanuman Mandir&#10;Garden Chowk"
          (input)="set('stops', $event)"
        ></textarea>

        @if (err()) {
          <div class="vd-err">{{ err() }}</div>
        }
        <button type="button" class="vd-btn lg block" [disabled]="busy()" (click)="save()">
          <vd-icon name="check" [size]="20" />Add bus
        </button>
      </div>
    </ion-content>
  `,
})
export class AddBusComponent {
  @Input({ required: true }) repo!: AdminRepo; // passed in: modals use the root injector

  // NB: never name this `modal`: Ionic reserves that property on components shown inside ion-modal.
  private readonly modalCtrl = inject(ModalController);

  readonly err = signal('');
  readonly busy = signal(false);
  private readonly form: Record<Field, string> = {
    name: '',
    regNo: '',
    capacity: '',
    fee: '',
    driverName: '',
    driverEmail: '',
    stops: '',
  };

  set(k: Field, e: Event): void {
    this.form[k] = (e.target as HTMLInputElement).value;
  }

  async save(): Promise<void> {
    this.err.set('');
    const f = this.form;
    this.busy.set(true);
    try {
      await this.repo.addVehicle({
        name: f.name.trim(),
        regNo: f.regNo.trim(),
        capacity: Number(f.capacity),
        fee: Math.round(Number(f.fee) * 100),
        driverName: f.driverName.trim(),
        driverEmail: f.driverEmail.trim(),
        stops: f.stops
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      await this.modalCtrl.dismiss(f.name.trim());
    } catch (e) {
      this.err.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
