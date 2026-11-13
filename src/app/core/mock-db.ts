import { Injectable } from '@angular/core';

/** Shared dummy tables (vehicle, stop, driver, guardian, student). Replaced by the API later; repos are the only readers. */
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

@Injectable({ providedIn: 'root' })
export class MockDb {
  n = 100;
  vehicles: Vehicle[] = [
    { id: 'v1', label: 'Van · MH-20 AB 1234', short: 'Van', cap: 6 },
    { id: 'v2', label: 'Mini bus · MH-20 CD 5678', short: 'Bus', cap: 14 },
  ];
  stops: Stop[] = [
    { id: 't1', veh: 'v1', name: 'Hanuman Mandir', seq: 1, typical: '07:05' },
    { id: 't2', veh: 'v1', name: 'Ganpati Mandir', seq: 2, typical: '07:15' },
    { id: 't3', veh: 'v1', name: 'Garden Chowk', seq: 3, typical: '07:25' },
    { id: 't4', veh: 'v1', name: 'Bus Stand', seq: 4, typical: '07:35' },
    { id: 't5', veh: 'v2', name: 'Station Road', seq: 1, typical: '07:10' },
    { id: 't6', veh: 'v2', name: 'Market Yard', seq: 2, typical: '07:25' },
  ];
  drivers: Driver[] = [
    { id: 'u1', name: 'Ramesh Kale', email: 'ramesh@vandesk.test', veh: 'v1', active: true },
    { id: 'u2', name: 'Suresh Wagh', email: 'suresh@vandesk.test', veh: 'v2', active: true },
  ];
  guardians: Guardian[] = [];
  students: Student[] = [];

  constructor() {
    const seed: [string, string, string, string, string, string][] = [
      ['Akshay Patil', '5', 'v1', 't1', 'Mr. Patil', '2026-06'],
      ['Ishita Patil', '3', 'v1', 't1', 'Mr. Patil', '2026-06'],
      ['Karthik Joshi', '6', 'v1', 't2', 'Mrs. Joshi', '2026-06'],
      ['Harsha Kulkarni', '7', 'v1', 't3', 'Mrs. Kulkarni', '2026-08'],
      ['Rohan More', '8', 'v1', 't3', 'Mrs. More', '2026-06'],
      ['Diya Naik', '4', 'v2', 't5', 'Mrs. Naik', '2026-06'],
      ['Kabir Sinha', '6', 'v2', 't6', 'Mr. Sinha', '2026-07'],
    ];
    const byName = new Map<string, string>();
    seed.forEach(([name, cls, veh, stop, guardian, joined], i) => {
      let gid = byName.get(guardian);
      if (!gid) {
        gid = 'g' + (this.guardians.length + 1);
        byName.set(guardian, gid);
        this.guardians.push({
          id: gid,
          name: guardian,
          email: guardian.replace(/\W+/g, '').toLowerCase() + '@mail.test',
          phone: '9820000' + (100 + i),
        });
      }
      this.students.push({ id: 's' + (i + 1), name, cls, veh, stop, gid, status: 'active', joined });
    });
  }
}
