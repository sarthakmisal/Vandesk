import type { Routes } from '@angular/router';

import { TabsPage } from './tabs.page';

export const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'fees',
        loadComponent: () => import('../fees/fees.page').then((m) => m.FeesPage),
      },
      {
        path: 'students',
        loadComponent: () => import('../students/students.page').then((m) => m.StudentsPage),
      },
      {
        path: 'trip',
        loadComponent: () => import('../trip/trip.page').then((m) => m.TripPage),
      },
      {
        path: 'ledger',
        loadComponent: () => import('../ledger/ledger.page').then((m) => m.LedgerPage),
      },
      {
        path: '',
        redirectTo: '/driver/trip',
        pathMatch: 'full',
      },
    ],
  },
];
