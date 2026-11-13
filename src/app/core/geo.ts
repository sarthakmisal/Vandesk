import { Injectable } from '@angular/core';

export interface Fix {
  lat: number;
  lng: number;
  accuracy: number;
}

/** Location only at the moment of a tap, in the foreground (R-LOC-1). Never blocks the tap for long (R-LOC-2). */
@Injectable({ providedIn: 'root' })
export class Geo {
  /** A fix up to 60 s old is fine; resolves undefined on denial, timeout or no support. */
  fix(timeoutMs = 1500): Promise<Fix | undefined> {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return Promise.resolve(undefined);
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(undefined), timeoutMs);
      navigator.geolocation.getCurrentPosition(
        (p) => {
          clearTimeout(timer);
          resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
        },
        () => {
          clearTimeout(timer);
          resolve(undefined);
        },
        { enableHighAccuracy: true, maximumAge: 60000, timeout: timeoutMs },
      );
    });
  }
}
