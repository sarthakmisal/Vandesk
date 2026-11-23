import type { OnInit } from '@angular/core';
import { Component, Input, inject, signal } from '@angular/core';
import { IonContent, ModalController } from '@ionic/angular';

import { L, T } from '../../core/i18n';
import type { Stop } from '../../core/mock-db';
import { IconComponent } from '../../ui/icon.component';
import type { NewStudent, StudentsRepo, VSeat } from '../students.repo';

type Field = 'name' | 'cls' | 'gname' | 'email' | 'phone';

/** Onboarding sheet: vehicle and stop are chips; a full vehicle is disabled; errors show inline. */
@Component({
  selector: 'app-add-student',
  templateUrl: './add-student.component.html',
  styleUrls: ['./add-student.component.scss'],
  imports: [IonContent, IconComponent],
})
export class AddStudentComponent implements OnInit {
  @Input({ required: true }) repo!: StudentsRepo; // passed in: modals use the root injector

  // NB: never name this `modal`: Ionic reserves that property on components shown inside ion-modal.
  private readonly modalCtrl = inject(ModalController);

  readonly t = signal(T[L()]);
  readonly veh = signal<VSeat[]>([]);
  readonly stops = signal<Stop[]>([]);
  readonly selVeh = signal('');
  readonly selStop = signal('');
  readonly err = signal('');
  private readonly form: Record<Field, string> = { name: '', cls: '', gname: '', email: '', phone: '' };

  async ngOnInit(): Promise<void> {
    const v = await this.repo.vehicles();
    this.veh.set(v);
    const free = v.find((x) => x.used < x.cap);
    if (free) {
      await this.pick(free.id);
    }
  }

  async pick(id: string): Promise<void> {
    this.selVeh.set(id);
    const s = await this.repo.stops(id);
    this.stops.set(s);
    this.selStop.set(s[0]?.id ?? '');
  }

  set(k: Field, e: Event): void {
    this.form[k] = (e.target as HTMLInputElement).value;
  }

  async save(): Promise<void> {
    this.err.set('');
    const f: NewStudent = { ...this.form, veh: this.selVeh(), stop: this.selStop() };
    try {
      await this.repo.add(f);
      await this.modalCtrl.dismiss(f.name.trim());
    } catch (e) {
      this.err.set((e as Error).message);
    }
  }
}
