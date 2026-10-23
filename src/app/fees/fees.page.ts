import { Component, OnInit } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import { FeesRepo } from './fees.repo';
import { Lang, Mode, Row, T, money } from './fees.models';
import { PaySheetComponent } from './pay-sheet.component';

@Component({ selector: 'app-fees', templateUrl: './fees.page.html', styleUrls: ['./fees.page.scss'], standalone: false })
export class FeesPage implements OnInit {
  rows: Row[] = []; today = 0; loading = true; err = false;
  langs: Lang[] = ['en', 'hi', 'mr']; lang: Lang = 'en'; m = money;
  constructor(private repo: FeesRepo, private modal: ModalController, private toast: ToastController) {}
  get t() { return T[this.lang]; }
  get pending() { return this.rows.reduce((a, r) => a + r.balance, 0); }
  trk = (_: number, r: Row) => r.id;
  hue = (s: string) => `hsl(${[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360} 70% 92%)`;
  ngOnInit() { try { this.lang = (localStorage.getItem('lang') as Lang) || 'en'; } catch {} this.load(); }
  setLang(l: Lang) { this.lang = l; try { localStorage.setItem('lang', l); } catch {} }
  async load() {
    try { [this.rows, this.today] = await Promise.all([this.repo.list(), this.repo.collectedToday()]); this.err = false; }
    catch { this.err = true; } finally { this.loading = false; }
  }
  async open(r: Row) {
    const m = await this.modal.create({ component: PaySheetComponent, componentProps: { row: r, t: this.t }, breakpoints: [0, 0.8], initialBreakpoint: 0.8 });
    await m.present();
    const { data } = await m.onDidDismiss<{ amount: number; mode: Mode }>();
    if (data) await this.done(r, data);
  }
  private async done(r: Row, d: { amount: number; mode: Mode }) {
    try {
      const id = await this.repo.record(r.id, d.amount, d.mode); await this.load();
      const to = await this.toast.create({ message: `✓ ${r.name} · ${money(d.amount)}`, duration: 8000, position: 'bottom', color: 'dark',
        buttons: [{ text: this.t['undo'], handler: async () => { await this.repo.undo(id); await this.load(); } }] });
      await to.present();
    } catch { (await this.toast.create({ message: this.t['err'], duration: 2500, color: 'danger' })).present(); }
  }
}
