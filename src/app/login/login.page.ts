import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular';

import type { Account } from '../core/auth';
import { AuthService } from '../core/auth';

@Component({
  selector: 'app-login',
  templateUrl: 'login.page.html',
  styleUrls: ['login.page.scss'],
  imports: [IonContent],
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private cd = inject(ChangeDetectorRef);
  groups: { t: string; list: Account[] }[] = [];
  err = '';

  ionViewWillEnter(): void {
    const a = this.auth.accounts();
    this.err = '';
    this.groups = [
      { t: 'VanDesk team', list: a.filter((x) => x.role === 'admin') },
      { t: 'Drivers', list: a.filter((x) => x.role === 'driver') },
      { t: 'Parents', list: a.filter((x) => x.role === 'parent') },
    ];
    this.cd.markForCheck();
  }

  go(a: Account): void {
    try {
      this.auth.login(a.id);
      this.router.navigateByUrl(this.auth.home(), { replaceUrl: true });
    } catch (e) {
      this.err = (e as Error).message;
      this.cd.markForCheck();
    }
  }
}
