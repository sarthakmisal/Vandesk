import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { IonContent, IonFab, ModalController, ToastController } from '@ionic/angular';

import { L, T } from '../fees/fees.models';
import { ProfileBarComponent } from '../shared/profile-bar/profile-bar.component';

import { AddStudentComponent } from './add-student.component';
import type { SRow, VSeat } from './students.repo';
import { StudentsRepo } from './students.repo';

@Component({
  selector: 'app-students',
  templateUrl: 'students.page.html',
  imports: [IonContent, IonFab, ProfileBarComponent],
})
export class StudentsPage {
  private repo = inject(StudentsRepo);
  private modalCtrl = inject(ModalController);
  private toast = inject(ToastController);
  private cd = inject(ChangeDetectorRef);
  rows: SRow[] = [];
  veh: VSeat[] = [];
  q = '';
  loading = true;

  get t(): Record<string, string> {
    return T[L()];
  }
  get shown(): SRow[] {
    const q = this.q.trim().toLowerCase();
    return q ? this.rows.filter((r) => (r.name + r.guardian + r.stop).toLowerCase().includes(q)) : this.rows;
  }

  ionViewWillEnter(): void {
    this.load();
  }

  async load(): Promise<void> {
    [this.rows, this.veh] = await Promise.all([this.repo.list(), this.repo.vehicles()]);
    this.loading = false;
    this.cd.markForCheck();
  }

  setQuery(e: Event): void {
    this.q = (e.target as HTMLInputElement).value;
  }

  async add(): Promise<void> {
    const m = await this.modalCtrl.create({
      component: AddStudentComponent,
      componentProps: { repo: this.repo, t: this.t },
      breakpoints: [0, 0.95],
      initialBreakpoint: 0.95,
    });
    await m.present();
    const { data } = await m.onDidDismiss<string>();
    if (data) {
      await this.load();
      (await this.toast.create({ message: '✓ ' + data, duration: 2500, color: 'dark' })).present();
    }
  }
}
