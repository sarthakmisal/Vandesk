import type { OnInit } from '@angular/core';
import { ChangeDetectorRef, Component, Input, inject } from '@angular/core';
import { IonContent, ModalController } from '@ionic/angular';

import type { Stop } from '../core/mock.db';

import type { NewStudent, StudentsRepo, VSeat } from './students.repo';

@Component({
  selector: 'app-add-student',
  templateUrl: 'add-student.component.html',
  styleUrls: ['add-student.component.scss'],
  imports: [IonContent],
})
export class AddStudentComponent implements OnInit {
  @Input() repo!: StudentsRepo; // repo passed in: modals use the root injector
  @Input() t!: Record<string, string>;
  // NB: never name this `modal` — Ionic reserves that property on components shown inside ion-modal.
  private modalCtrl = inject(ModalController);
  private cd = inject(ChangeDetectorRef);
  veh: VSeat[] = [];
  stops: Stop[] = [];
  err = '';
  f: NewStudent = { name: '', cls: '', veh: '', stop: '', gname: '', email: '', phone: '' };

  async ngOnInit(): Promise<void> {
    this.veh = await this.repo.vehicles();
    const v = this.veh.find((x) => x.used < x.cap);
    if (v) await this.pick(v.id);
    this.cd.markForCheck();
  }

  async pick(id: string): Promise<void> {
    this.f.veh = id;
    this.stops = await this.repo.stops(id);
    this.f.stop = this.stops[0]?.id ?? '';
    this.cd.markForCheck();
  }

  set(k: 'name' | 'cls' | 'gname' | 'email' | 'phone', e: Event): void {
    this.f[k] = (e.target as HTMLInputElement).value;
  }

  async save(): Promise<void> {
    this.err = '';
    try {
      await this.repo.add(this.f);
      this.modalCtrl.dismiss(this.f.name.trim());
    } catch (e) {
      this.err = (e as Error).message;
      this.cd.markForCheck();
    }
  }
}
