import { AdminRepo, MockAdminRepo } from '../admin/admin.repo';
import { FeesRepo, MockFeesRepo } from '../fees/fees.repo';
import { MockStudentsRepo, StudentsRepo } from '../students/students.repo';
import { MockTripRepo, TripRepo } from '../trip/trip.repo';

/** Root-level singletons so driver and parent screens share the same data. Swap each useClass for an HTTP repo to go live. */
export const REPO_PROVIDERS = [
  { provide: FeesRepo, useClass: MockFeesRepo },
  { provide: StudentsRepo, useClass: MockStudentsRepo },
  { provide: TripRepo, useClass: MockTripRepo },
  { provide: AdminRepo, useClass: MockAdminRepo },
];
