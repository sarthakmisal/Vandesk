import type { Provider } from '@angular/core';

import { environment } from '../../environments/environment';
import { HttpAdminRepo } from '../admin/admin.http.repo';
import { AdminRepo, MockAdminRepo } from '../admin/admin.repo';
import { HttpFeesRepo } from '../fees/fees.http.repo';
import { FeesRepo, MockFeesRepo } from '../fees/fees.repo';
import { HttpStudentsRepo } from '../students/students.http.repo';
import { MockStudentsRepo, StudentsRepo } from '../students/students.repo';
import { HttpTripRepo } from '../trip/trip.http.repo';
import { MockTripRepo, TripRepo } from '../trip/trip.repo';

/** In-memory demo data. Used by `npm start` (environment.useMock) and by the unit tests. */
export const MOCK_REPO_PROVIDERS: Provider[] = [
  { provide: FeesRepo, useClass: MockFeesRepo },
  { provide: StudentsRepo, useClass: MockStudentsRepo },
  { provide: TripRepo, useClass: MockTripRepo },
  { provide: AdminRepo, useClass: MockAdminRepo },
];

/** The real Node API (server/). */
export const HTTP_REPO_PROVIDERS: Provider[] = [
  { provide: FeesRepo, useClass: HttpFeesRepo },
  { provide: StudentsRepo, useClass: HttpStudentsRepo },
  { provide: TripRepo, useClass: HttpTripRepo },
  { provide: AdminRepo, useClass: HttpAdminRepo },
];

export const REPO_PROVIDERS: Provider[] = environment.useMock ? MOCK_REPO_PROVIDERS : HTTP_REPO_PROVIDERS;
