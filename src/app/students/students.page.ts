import { Component, computed, inject, signal } from '@angular/core';
import { IonContent, IonFab, ModalController, ToastController } from '@ionic/angular';

import { L, T } from '../core/i18n';
import { ProfileBarComponent } from '../profile-bar/profile-bar.component';

import { AddStudentComponent } from './add-student/add-student.component';
import type { SRow, VSeat } from './students.repo';
import { StudentsRepo } from './students.repo';

@Component({
  selector: 'app-students',
  templateUrl: 'students.page.html',
  styleUrls: ['students.page.scss'],
  imports: [IonContent, IonFab, ProfileBarComponent],
})
export class StudentsPage {
  private readonly repo = inject(StudentsRepo);
  private readonly modal = inject(ModalController);
  private readonly toast = inject(ToastController);

  readonly rows = signal<SRow[]>([]);
  readonly veh = signal<VSeat[]>([]);
  readonly q = signal('');
  readonly loading = signal(true);
  readonly t = computed(() => T[L()]);
  readonly shown = computed(() => {
    const q = this.q().trim().toLowerCase();
    return q ? this.rows().filter((r) => (r.name + r.guardian + r.stop).toLowerCase().includes(q)) : this.rows();
  });

  ionViewWillEnter(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.rows.set(await this.repo.list());
    this.veh.set(await this.repo.vehicles());
    this.loading.set(false);
  }

  onSearch(e: Event): void {
    this.q.set((e.target as HTMLInputElement).value);
  }

  async add(): Promise<void> {
    const modal = await this.modal.create({
      component: AddStudentComponent,
      componentProps: { repo: this.repo },
      breakpoints: [0, 0.95],
      initialBreakpoint: 0.95,
    });
    await modal.present();
    const { data } = await modal.onDidDismiss<string>();
    if (data) {
      await this.load();
      const toast = await this.toast.create({ message: '✓ ' + data, duration: 2500, color: 'dark' });
      await toast.present();
    }
  }
}
