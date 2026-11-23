import type { OnInit } from '@angular/core';
import { Component, Input, inject, signal } from '@angular/core';
import { IonContent, ModalController } from '@ionic/angular';

import type { Stop } from '../../core/mock-db';
import type { SRow, StudentsRepo, VSeat } from '../../students/students.repo';
import { IconComponent } from '../../ui/icon.component';
import type { AdminRepo } from '../admin.repo';

/** Move a student to another bus and/or pickup stop. A full bus is disabled; fees follow the student. */
@Component({
  selector: 'app-move-student',
  imports: [IonContent, IconComponent],
  template: `
    <ion-content>
      <div class="vd-sheet-body">
        <h2>{{ student.name }}</h2>
        <div class="vd-muted">
          Class {{ student.cls }} · now on {{ student.vehicle }}{{ student.stop ? ' · ' + student.stop : '' }}
        </div>

        <span class="vd-label">Bus</span>
        <div class="vd-chips">
          @for (v of veh(); track v.id) {
            <button
              type="button"
              class="vd-chip"
              [class.on]="selVeh() === v.id"
              [disabled]="v.used >= v.cap && v.id !== student.veh"
              (click)="pick(v.id)"
            >
              {{ v.short }}<small>{{ seats(v) }}</small>
            </button>
          }
        </div>

        <span class="vd-label">Pickup stop</span>
        <div class="vd-chips">
          @for (s of stops(); track s.id) {
            <button type="button" class="vd-chip" [class.on]="selStop() === s.id" (click)="selStop.set(s.id)">
              {{ s.name }}
            </button>
          }
          <button type="button" class="vd-chip" [class.on]="selStop() === ''" (click)="selStop.set('')">
            No stop yet
          </button>
        </div>

        <p class="vd-muted note">
          Fees stay with the student. Dues already raised keep their amount; from the next month the new bus's fee
          applies.
        </p>

        @if (err()) {
          <div class="vd-err">{{ err() }}</div>
        }
        <button type="button" class="vd-btn lg block" [disabled]="busy()" (click)="save()">
          <vd-icon name="check" [size]="20" />Save
        </button>
      </div>
    </ion-content>
  `,
  styles: '.note{margin:16px 2px 0;line-height:1.45}',
})
export class MoveStudentComponent implements OnInit {
  @Input({ required: true }) student!: SRow;
  @Input({ required: true }) repo!: AdminRepo; // passed in: modals use the root injector
  @Input({ required: true }) students!: StudentsRepo;

  // NB: never name this `modal`: Ionic reserves that property on components shown inside ion-modal.
  private readonly modalCtrl = inject(ModalController);

  readonly veh = signal<VSeat[]>([]);
  readonly stops = signal<Stop[]>([]);
  readonly selVeh = signal('');
  readonly selStop = signal('');
  readonly err = signal('');
  readonly busy = signal(false);

  async ngOnInit(): Promise<void> {
    this.veh.set(await this.students.vehicles());
    this.selVeh.set(this.student.veh);
    this.stops.set(await this.students.stops(this.student.veh));
    this.selStop.set(this.student.stopId);
  }

  seats(v: VSeat): string {
    const free = v.cap - v.used;
    return v.id === this.student.veh ? 'Current' : free <= 0 ? 'Full' : `${free} ${free === 1 ? 'seat' : 'seats'} free`;
  }

  async pick(id: string): Promise<void> {
    this.selVeh.set(id);
    const s = await this.students.stops(id);
    this.stops.set(s);
    this.selStop.set(id === this.student.veh ? this.student.stopId : (s[0]?.id ?? ''));
  }

  async save(): Promise<void> {
    this.err.set('');
    this.busy.set(true);
    try {
      await this.repo.moveStudent(this.student.id, this.selVeh(), this.selStop());
      await this.modalCtrl.dismiss(this.student.name);
    } catch (e) {
      this.err.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
