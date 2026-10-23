import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: 'fees', loadChildren: () => import('./fees/fees.module').then(m => m.FeesModule) },
  { path: '', pathMatch: 'full', redirectTo: 'fees' },
  { path: '**', redirectTo: 'fees' }, // any unknown URL lands on the fees list, never a blank screen
];

// useHash: refresh / deep links never hit a server 404 (safe when Node serves the build)
@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true, preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
