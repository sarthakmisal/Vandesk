import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ErrorHandler, inject, provideAppInitializer } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/core/api';
import { AuthService } from './app/core/auth.service';
import { REPO_PROVIDERS } from './app/core/providers';
import { SafeErrorHandler } from './app/core/safe-error-handler';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: ErrorHandler, useClass: SafeErrorHandler },
    provideIonicAngular({ mode: 'md' }),
    // Hash routing: refresh and deep links never hit a server 404 when a plain Node server serves www/.
    provideRouter(routes, withHashLocation(), withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    // API mode: restore the session from the stored token before any route is matched (no flash of /login).
    provideAppInitializer(() => inject(AuthService).restore()),
    ...REPO_PROVIDERS,
  ],
});
