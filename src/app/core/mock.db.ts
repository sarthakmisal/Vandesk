import { Injectable } from '@angular/core';

/** Shared dummy tables (vehicle, stop, guardian, student). Replaced by the API later; repos are the only readers. */
export interface Vehicle {
  id: string;
  label: string;
  short: string;
  cap: number;
}
export interface Stop {
  id: string;
  veh: string;
  name: string;
  seq: number;
  typical: string;
}
export interface Driver {
  id: string;
  name: string;
  email: string;
  veh: string;
  active: boolean;
}
export interface Guardian {
  id: string;
  name: string;
  email: string;
  phone: string;
}
export interface Student {
  id: string;
  name: string;
  cls: string;
  veh: string;
  stop: string;
  gid: string;
  status: 'active' | 'paused' | 'left';
  joined: string;
}

// [id, vehicle, name, seq, typical time]
const STOPS: [string, string, string, number, string][] = [
  ['t1', 'v1', 'Hanuman Mandir', 1, '07:05'],
  ['t2', 'v1', 'Ganpati Mandir', 2, '07:15'],
  ['t3', 'v1', 'Garden Chowk', 3, '07:25'],
  ['t4', 'v1', 'Bus Stand', 4, '07:35'],
  ['t5', 'v2', 'Station Road', 1, '07:10'],
  ['t6', 'v2', 'Market Yard', 2, '07:25'],
];

// [name, class, vehicle, stop, guardian, joined]
const KIDS: [string, string, string, string, string, string][] = [
  ['Akshay Patil', '5', 'v1', 't1', 'Mr. Patil', '2026-06'],
  ['Ishita Patil', '3', 'v1', 't1', 'Mr. Patil', '2026-06'],
  ['Karthik Joshi', '6', 'v1', 't2', 'Mrs. Joshi', '2026-06'],
  ['Harsha Kulkarni', '7', 'v1', 't3', 'Mrs. Kulkarni', '2026-08'],
  ['Rohan More', '8', 'v1', 't3', 'Mrs. More', '2026-06'],
  ['Diya Naik', '4', 'v2', 't5', 'Mrs. Naik', '2026-06'],
  ['Kabir Sinha', '6', 'v2', 't6', 'Mr. Sinha', '2026-07'],
];

@Injectable({ providedIn: 'root' })
export class MockDb {
  n = 100;
  drivers: Driver[] = [
    { id: 'u1', name: 'Ramesh Kale', email: 'ramesh@vandesk.test', veh: 'v1', active: true },
    { id: 'u2', name: 'Suresh Wagh', email: 'suresh@vandesk.test', veh: 'v2', active: true },
  ];
  vehicles: Vehicle[] = [
    { id: 'v1', label: 'Van · MH-20 AB 1234', short: 'Van', cap: 6 },
    { id: 'v2', label: 'Mini bus · MH-20 CD 5678', short: 'Bus', cap: 14 },
  ];
  stops: Stop[] = STOPS.map(([id, veh, name, seq, typical]) => ({ id, veh, name, seq, typical }));
  guardians: Guardian[] = [];
  students: Student[] = [];

  constructor() {
    const G: Record<string, string> = {};
    KIDS.forEach(([name, cls, veh, stop, g, joined], i) => {
      if (!G[g]) {
        G[g] = 'g' + (this.guardians.length + 1);
        this.guardians.push({
          id: G[g],
          name: g,
          email: g.replace(/\W+/g, '').toLowerCase() + '@mail.test',
          phone: '9820000' + (100 + i),
        });
      }
      this.students.push({ id: 's' + (i + 1), name, cls, veh, stop, gid: G[g], status: 'active', joined });
    });
  }
}
