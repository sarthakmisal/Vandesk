import { HttpErrorResponse } from '@angular/common/http';

import { message } from './api';

describe('message', () => {
  it('shows the server text when the API answers', () => {
    expect(message(new HttpErrorResponse({ status: 409, error: { error: 'Honda is full' } }))).toBe('Honda is full');
  });

  it('explains clearly when the page is served without the API behind it', () => {
    expect(message(new HttpErrorResponse({ status: 404, error: '<html></html>' }))).toContain(
      'Cannot reach the VanDesk server',
    );
    expect(message(new HttpErrorResponse({ status: 200, error: '<!doctype html>' }))).toContain(
      'Cannot reach the VanDesk server',
    );
  });

  it('says so when offline', () => {
    expect(message(new HttpErrorResponse({ status: 0 }))).toContain('No connection');
  });
});
