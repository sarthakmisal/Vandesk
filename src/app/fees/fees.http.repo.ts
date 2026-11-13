import { Injectable, inject } from '@angular/core';

import { Api } from '../core/api';

import type { LedgerRow, Mode, PlanRow, RemindResult, Row, Statement } from './fees.models';
import { FeesRepo } from './fees.repo';

/** FeesRepo over the Node API. Same contract as the mock; money stays in integer paise. */
@Injectable()
export class HttpFeesRepo extends FeesRepo {
  private readonly api = inject(Api);

  list(): Promise<Row[]> {
    return this.api.get<Row[]>('/fees/pending');
  }

  async collectedToday(): Promise<number> {
    return (await this.api.get<{ amount: number }>('/fees/collected-today')).amount;
  }

  async record(studentId: string, amount: number, mode: Mode): Promise<string> {
    // clientUuid makes a retry (flaky network) safe: the server will not record the payment twice.
    return (
      await this.api.post<{ id: string }>('/payments', { studentId, amount, mode, clientUuid: crypto.randomUUID() })
    ).id;
  }

  async reverse(paymentId: string, note: string): Promise<void> {
    await this.api.post(`/payments/${paymentId}/reverse`, { note });
  }

  ledger(): Promise<LedgerRow[]> {
    return this.api.get<LedgerRow[]>('/payments');
  }

  plans(): Promise<PlanRow[]> {
    return this.api.get<PlanRow[]>('/fee-plans');
  }

  async addPlan(amount: number, from: string): Promise<void> {
    await this.api.post('/fee-plans', { amount, from });
  }

  remind(): Promise<RemindResult> {
    return this.api.post<RemindResult>('/reminders/send');
  }

  statement(studentId: string): Promise<Statement> {
    return this.api.get<Statement>(`/students/${studentId}/statement`);
  }
}
