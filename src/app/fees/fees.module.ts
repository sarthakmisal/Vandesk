import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { FeesPage } from './fees.page';
import { PaySheetComponent } from './pay-sheet.component';
import { FeesRepo, MockFeesRepo } from './fees.repo';

@NgModule({
  imports: [CommonModule, IonicModule,
    // unknown sub-path -> back to the list, never a blank screen
    RouterModule.forChild([{ path: '', component: FeesPage }, { path: '**', redirectTo: '', pathMatch: 'full' }])],
  declarations: [FeesPage, PaySheetComponent],
  providers: [{ provide: FeesRepo, useClass: MockFeesRepo }], // swap to HttpFeesRepo later
})
export class FeesModule {}
