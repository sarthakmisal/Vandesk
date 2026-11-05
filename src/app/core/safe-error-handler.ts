import type { ErrorHandler } from '@angular/core';
import { Injectable } from '@angular/core';

/** Reload once if a lazy chunk fails (e.g. right after a new deploy); otherwise just log. */
@Injectable()
export class SafeErrorHandler implements ErrorHandler {
  handleError(e: unknown): void {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    const bad = /ChunkLoadError|Loading chunk|dynamically imported module/i.test(msg);
    try {
      if (bad && !sessionStorage.getItem('r')) {
        sessionStorage.setItem('r', '1');
        location.reload();
      }
    } catch {
      /* storage unavailable: just log */
    }
  }
}
