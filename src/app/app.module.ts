import { ErrorHandler, Injectable, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { IonicModule } from '@ionic/angular';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

/** Reload once if a lazy chunk fails (e.g. right after a new deploy); otherwise just log. */
@Injectable()
export class SafeErrorHandler implements ErrorHandler {
  handleError(e: any) {
    console.error(e);
    const bad = /ChunkLoadError|Loading chunk|dynamically imported module/i.test(String(e?.message ?? e));
    try { if (bad && !sessionStorage.getItem('r')) { sessionStorage.setItem('r', '1'); location.reload(); } } catch {}
  }
}

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, IonicModule.forRoot({ mode: 'md' }), AppRoutingModule],
  providers: [{ provide: ErrorHandler, useClass: SafeErrorHandler }],
  bootstrap: [AppComponent],
})
export class AppModule {}
