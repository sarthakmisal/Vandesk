import type { HttpInterceptorFn } from '@angular/common/http';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';
import { catchError, firstValueFrom, throwError } from 'rxjs';

import { environment } from '../../environments/environment';

import { AuthService } from './auth.service';

/** Small wrapper over HttpClient: promises, and server errors become Error(message) that the screens already show. */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  get<T>(path: string): Promise<T> {
    return this.run(this.http.get<T>(environment.apiUrl + path));
  }

  post<T>(path: string, body: unknown = {}): Promise<T> {
    return this.run(this.http.post<T>(environment.apiUrl + path, body));
  }

  put<T>(path: string, body: unknown = {}): Promise<T> {
    return this.run(this.http.put<T>(environment.apiUrl + path, body));
  }

  private async run<T>(o: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(o);
    } catch (e) {
      throw new Error(message(e), { cause: e });
    }
  }
}

export const message = (e: unknown): string => {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) {
      return 'No connection. Check your internet.';
    }
    const text = (e.error as { error?: string } | null)?.error;
    return text ?? 'Something went wrong';
  }
  return e instanceof Error ? e.message : 'Something went wrong';
};

/** Adds the session token; a 401 anywhere (expired or suspended) signs out and returns to /login. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const authed =
    token && req.url.startsWith(environment.apiUrl)
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;
  return next(authed).pipe(
    catchError((e: HttpErrorResponse) => {
      if (e.status === 401 && !req.url.includes('/auth/') && auth.session()) {
        auth.logout();
        void router.navigateByUrl('/login', { replaceUrl: true });
      }
      return throwError(() => e);
    }),
  );
};
