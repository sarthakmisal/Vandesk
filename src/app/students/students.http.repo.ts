import { Injectable, inject } from '@angular/core';

import { Api } from '../core/api';
import type { Stop } from '../core/mock-db';

import type { NewStudent, SRow, VSeat } from './students.repo';
import { StudentsRepo } from './students.repo';

@Injectable()
export class HttpStudentsRepo extends StudentsRepo {
  private readonly api = inject(Api);

  list(): Promise<SRow[]> {
    return this.api.get<SRow[]>('/students');
  }

  vehicles(): Promise<VSeat[]> {
    return this.api.get<VSeat[]>('/vehicles');
  }

  stops(veh: string): Promise<Stop[]> {
    return this.api.get<Stop[]>(`/vehicles/${veh}/stops`);
  }

  async add(f: NewStudent): Promise<void> {
    await this.api.post('/students', f);
  }
}
