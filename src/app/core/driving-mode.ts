import { Injectable, signal } from '@angular/core';

/** While a trip is running the tab bar is hidden, so a bump on the stand cannot switch screens. */
@Injectable({ providedIn: 'root' })
export class DrivingMode {
  readonly on = signal(false);
}
