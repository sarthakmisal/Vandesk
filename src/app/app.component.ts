import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';

import { ToastComponent } from './ui/toast.component';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, ToastComponent],
})
export class AppComponent {}
