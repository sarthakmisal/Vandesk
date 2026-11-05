import type { Routes } from '@angular/router';

import { TabsPage } from './tabs.page';

/** Driver area: mounted at /driver by app.routes.ts. */
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
        path: '',
        pathMatch: 'full',
        redirectTo: 'fees',
      },
    ],
  },
];
