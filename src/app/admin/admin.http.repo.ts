import { Injectable, inject } from '@angular/core';

import { Api } from '../core/api';

import type { Overview } from './admin.repo';
import { AdminRepo } from './admin.repo';

@Injectable()
export class HttpAdminRepo extends AdminRepo {
  private readonly api = inject(Api);

  overview(): Promise<Overview> {
    return this.api.get<Overview>('/admin/overview');
  }

  async setDriverActive(driverId: string, active: boolean): Promise<void> {
    await this.api.put(`/admin/drivers/${driverId}`, { active });
  }
}
