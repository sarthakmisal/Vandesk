import { Injectable, inject } from '@angular/core';

import { Api } from '../core/api';

import type { NewVehicle, Overview, VehicleEdit } from './admin.repo';
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

  async addVehicle(f: NewVehicle): Promise<void> {
    await this.api.post('/admin/vehicles', f);
  }

  async updateVehicle(id: string, f: VehicleEdit): Promise<void> {
    await this.api.put(`/admin/vehicles/${id}`, f);
  }

  async setInService(id: string, inService: boolean): Promise<void> {
    await this.api.put(`/admin/vehicles/${id}/in-service`, { inService });
  }

  async changeDriver(id: string, name: string, email: string): Promise<void> {
    await this.api.put(`/admin/vehicles/${id}/driver`, { name, email });
  }

  async setFee(id: string, amount: number, from: string): Promise<void> {
    await this.api.post(`/admin/vehicles/${id}/fee-plans`, { amount, from });
  }

  async addStop(veh: string, name: string, typical: string): Promise<void> {
    await this.api.post(`/admin/vehicles/${veh}/stops`, { name, typical });
  }

  async updateStop(id: string, f: { name?: string; typical?: string }): Promise<void> {
    await this.api.put(`/admin/stops/${id}`, f);
  }

  async moveStop(id: string, dir: 'up' | 'down'): Promise<void> {
    await this.api.post(`/admin/stops/${id}/move`, { dir });
  }

  async deleteStop(id: string): Promise<void> {
    await this.api.delete(`/admin/stops/${id}`);
  }

  async moveStudent(id: string, veh: string, stop: string): Promise<void> {
    await this.api.put(`/admin/students/${id}/placement`, { veh, stop });
  }
}
