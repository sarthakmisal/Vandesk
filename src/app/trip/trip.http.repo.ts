import { Injectable, inject } from '@angular/core';

import { Api } from '../core/api';
import type { Direction } from '../core/direction';
import type { Fix } from '../core/geo';

import type { PInfo, TRow, TState } from './trip.repo';
import { TripRepo } from './trip.repo';

interface TripView {
  state: TState;
  roster: TRow[];
}

@Injectable()
export class HttpTripRepo extends TripRepo {
  private readonly api = inject(Api);

  async roster(dir: Direction): Promise<TRow[]> {
    return (await this.api.get<TripView>(`/trip?direction=${dir}`)).roster;
  }

  async state(dir: Direction): Promise<TState> {
    return (await this.api.get<TripView>(`/trip?direction=${dir}`)).state;
  }

  async start(dir: Direction): Promise<void> {
    await this.api.post('/trip/start', { direction: dir });
  }

  async end(dir: Direction): Promise<void> {
    await this.api.post('/trip/end', { direction: dir });
  }

  async tap(studentId: string, direction: Direction, fix?: Fix): Promise<void> {
    await this.api.post('/trip/tap', { studentId, direction, kind: 'boarded', ...fix });
  }

  async notThere(studentId: string, direction: Direction): Promise<void> {
    await this.api.post('/trip/tap', { studentId, direction, kind: 'skipped' });
  }

  children(): Promise<{ id: string; name: string }[]> {
    return this.api.get('/children');
  }

  parent(sid: string, dir: Direction): Promise<PInfo> {
    return this.api.get<PInfo>(`/children/${sid}/trip?direction=${dir}`);
  }

  async setGoing(sid: string, going: boolean, direction: Direction): Promise<void> {
    await this.api.put(`/children/${sid}/attendance`, { going, direction });
  }

  async reset(): Promise<void> {
    /* demo only: nothing to reset on a real server */
  }
}
