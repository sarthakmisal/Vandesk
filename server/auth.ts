import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import { HttpError } from './http.ts';

export type Role = 'admin' | 'driver' | 'parent';
export type Perm =
  | 'fees.read'
  | 'fees.record'
  | 'students.read'
  | 'students.add'
  | 'trip.run'
  | 'attendance.set'
  | 'admin.view'
  | 'drivers.manage';

/** Keep in sync with src/app/core/auth.service.ts. The server is the real security boundary. */
export const PERMS: Record<Role, Perm[]> = {
  admin: ['admin.view', 'drivers.manage', 'students.read', 'fees.read'],
  driver: ['fees.read', 'fees.record', 'students.read', 'students.add', 'trip.run'],
  parent: ['fees.read', 'attendance.set'],
};

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  vehicle_id: string | null;
  active: boolean;
}

export function need(u: User, p: Perm): void {
  if (!PERMS[u.role].includes(p)) {
    throw new HttpError(403, 'Not allowed');
  }
}

const b64 = (s: string) => Buffer.from(s).toString('base64url');
const sig = (secret: string, body: string) => createHmac('sha256', secret).update(body).digest('base64url');

/** Long-lived sessions so drivers do not sign in daily (R-AUTH-2): driver/admin 30 days, parent 90 days. */
export function signToken(secret: string, u: User, now: Date): string {
  const days = u.role === 'parent' ? 90 : 30;
  const body = b64(JSON.stringify({ uid: u.id, exp: now.getTime() + days * 86400000 }));
  return `${body}.${sig(secret, body)}`;
}

export function verifyToken(secret: string, token: string, now: Date): string | null {
  const [body, mac] = token.split('.');
  if (!body || !mac) {
    return null;
  }
  const want = Buffer.from(sig(secret, body));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) {
    return null;
  }
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as { uid: string; exp: number };
    return p.exp > now.getTime() ? p.uid : null;
  } catch {
    return null;
  }
}

export const newCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');
export const hashCode = (secret: string, email: string, code: string): string =>
  createHash('sha256').update(`${secret}:${email}:${code}`).digest('hex');
