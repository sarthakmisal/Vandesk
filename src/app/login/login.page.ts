import type { OnInit } from '@angular/core';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular';

import { environment } from '../../environments/environment';
import type { Account } from '../core/auth.service';
import { AuthService } from '../core/auth.service';
import { IconComponent } from '../ui/icon.component';

/**
 * API mode: email + 6-digit code (OTP) sent by email. Mock mode: pick a demo account.
 * In development (no SMTP) the server also returns the code so the demo works without an inbox.
 */
@Component({
  selector: 'app-login',
  templateUrl: 'login.page.html',
  styleUrls: ['login.page.scss'],
  imports: [IonContent, IconComponent],
})
export class LoginPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly mock = environment.useMock;
  readonly groups = signal<{ t: string; list: Account[] }[]>([]);
  readonly err = signal('');
  readonly step = signal<'email' | 'code'>('email');
  readonly email = signal('');
  readonly code = signal('');
  readonly hint = signal('');
  readonly busy = signal(false);

  ngOnInit(): void {
    this.refresh();
  }

  ionViewWillEnter(): void {
    this.refresh();
  }

  /** Mock mode. */
  go(a: Account): void {
    try {
      this.auth.login(a.id);
      this.enter();
    } catch (e) {
      this.err.set((e as Error).message);
    }
  }

  /** API mode, step 1. */
  async send(): Promise<void> {
    await this.guard(async () => {
      const r = await this.auth.requestOtp(this.email().trim());
      this.hint.set(r.devCode ? `Development code: ${r.devCode}` : '');
      this.step.set('code');
    });
  }

  /** API mode, step 2. */
  async verify(): Promise<void> {
    await this.guard(async () => {
      await this.auth.verifyOtp(this.email().trim(), this.code().trim());
      this.enter();
    });
  }

  back(): void {
    this.step.set('email');
    this.code.set('');
    this.err.set('');
  }

  on(sig: { set(v: string): void }, e: Event): void {
    sig.set((e.target as HTMLInputElement).value);
  }

  private async guard(f: () => Promise<void>): Promise<void> {
    this.err.set('');
    this.busy.set(true);
    try {
      await f();
    } catch (e) {
      this.err.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  private enter(): void {
    void this.router.navigateByUrl(this.auth.home(), { replaceUrl: true });
  }

  private refresh(): void {
    if (!this.mock) {
      return;
    }
    const a = this.auth.accounts();
    this.err.set('');
    this.groups.set([
      { t: 'VanDesk team', list: a.filter((x) => x.role === 'admin') },
      { t: 'Drivers', list: a.filter((x) => x.role === 'driver') },
      { t: 'Parents', list: a.filter((x) => x.role === 'parent') },
    ]);
  }
}
