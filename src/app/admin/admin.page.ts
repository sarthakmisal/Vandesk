import { Component, computed, inject, signal } from '@angular/core';
import { IonContent, ModalController } from '@ionic/angular';

import { money } from '../core/format';
import { ProfileBarComponent } from '../profile-bar/profile-bar.component';
import { AddStudentComponent } from '../students/add-student/add-student.component';
import type { SRow } from '../students/students.repo';
import { StudentsRepo } from '../students/students.repo';
import { IconComponent } from '../ui/icon.component';
import { Toast } from '../ui/toast.service';

import { AddBusComponent } from './add-bus/add-bus.component';
import type { Overview, VOver } from './admin.repo';
import { AdminRepo } from './admin.repo';
import { BusSheetComponent } from './bus-sheet/bus-sheet.component';
import { MoveStudentComponent } from './move-student/move-student.component';

/** VanDesk team: buses, drivers, stops, fees and who rides which bus. No daily operations (trips, payments). */
@Component({
  selector: 'app-admin',
  templateUrl: 'admin.page.html',
  styleUrls: ['admin.page.scss'],
  imports: [IonContent, ProfileBarComponent, IconComponent],
})
export class AdminPage {
  private readonly repo = inject(AdminRepo);
  private readonly studentsRepo = inject(StudentsRepo);
  private readonly modal = inject(ModalController);
  private readonly toast = inject(Toast);

  readonly view = signal<'buses' | 'students'>('buses');
  readonly o = signal<Overview | undefined>(undefined);
  readonly rows = signal<SRow[]>([]);
  readonly q = signal('');
  readonly money = money;
  readonly shown = computed(() => {
    const q = this.q().trim().toLowerCase();
    return q
      ? this.rows().filter((r) => (r.name + r.guardian + r.stop + r.vehicle).toLowerCase().includes(q))
      : this.rows();
  });

  ionViewWillEnter(): void {
    void this.load();
  }

  async load(): Promise<void> {
    const [o, rows] = await Promise.all([this.repo.overview(), this.studentsRepo.list()]);
    this.o.set(o);
    this.rows.set(rows);
  }

  onSearch(e: Event): void {
    this.q.set((e.target as HTMLInputElement).value);
  }

  async addBus(): Promise<void> {
    const name = await this.open<string>(AddBusComponent, { repo: this.repo }, 0.95);
    if (name) {
      this.toast.show(name + ' added');
    }
  }

  async manage(v: VOver): Promise<void> {
    await this.open(BusSheetComponent, { vehicleId: v.id, repo: this.repo, students: this.studentsRepo }, 0.95);
  }

  async addStudent(): Promise<void> {
    const name = await this.open<string>(AddStudentComponent, { repo: this.studentsRepo }, 0.95);
    if (name) {
      this.toast.show(name + ' added');
    }
  }

  async move(r: SRow): Promise<void> {
    const name = await this.open<string>(
      MoveStudentComponent,
      { student: r, repo: this.repo, students: this.studentsRepo },
      0.8,
    );
    if (name) {
      this.toast.show(name + ' moved');
    }
  }

  /** Shows a bottom sheet, then refreshes the page behind it whatever happened inside. */
  private async open<T>(component: unknown, props: Record<string, unknown>, height: number): Promise<T | undefined> {
    const m = await this.modal.create({
      component: component as never,
      componentProps: props,
      cssClass: 'vd-sheet',
      breakpoints: [0, height],
      initialBreakpoint: height,
    });
    await m.present();
    const { data } = await m.onDidDismiss<T>();
    await this.load();
    return data;
  }
}
