import { ErrorHandler } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  RouteReuseStrategy,
  provideRouter,
  withComponentInputBinding,
  withHashLocation,
  withPreloading,
  PreloadAllModules,
} from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { REPO_PROVIDERS } from './app/core/providers';
import { SafeErrorHandler } from './app/core/safe-error-handler';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    // mode 'md': same Material look on every device, as in the original UI
    provideIonicAngular({ mode: 'md' }),
    // hash location: refresh / deep links never hit a server 404 (also safe inside Capacitor)
    provideRouter(routes, withHashLocation(), withPreloading(PreloadAllModules), withComponentInputBinding()),
    { provide: ErrorHandler, useClass: SafeErrorHandler },
    ...REPO_PROVIDERS,
  ],
}).catch((err) => console.error(err));
