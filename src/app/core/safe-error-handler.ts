import type { ErrorHandler } from '@angular/core';
import { Injectable } from '@angular/core';

/** Reload once if a lazy chunk fails to load (e.g. right after a new deploy); otherwise just log. */
@Injectable()
export class SafeErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    console.error(error);
    const msg = String((error as Error | undefined)?.message ?? error);
    const chunkFailed = /ChunkLoadError|Loading chunk|dynamically imported module/i.test(msg);
    try {
      if (chunkFailed && !sessionStorage.getItem('vd_reloaded')) {
        sessionStorage.setItem('vd_reloaded', '1');
        location.reload();
      }
    } catch {
      /* storage unavailable: do not loop */
    }
  }
}
