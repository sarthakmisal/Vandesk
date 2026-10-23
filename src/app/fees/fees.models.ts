export type Mode = 'cash' | 'upi';
export type Lang = 'en' | 'hi' | 'mr';
/** One pending student row. Money is always in paise. */
export interface Row { id: string; name: string; cls: string; vehicle: string; months: number; balance: number; steps: number[]; since: string; }
export const money = (p: number) => '₹' + (p / 100).toLocaleString('en-IN');
export const T: Record<Lang, Record<string, string>> = {
  en: { title: 'Fees', pending: 'Pending', today: 'Collected today', months: 'months pending', received: 'Received', cash: 'Cash', upi: 'UPI', other: 'Other amount', undo: 'UNDO', clear: 'All fees are collected', retry: 'Try again', err: 'Could not load', all: 'All' },
  hi: { title: 'फीस', pending: 'बाकी', today: 'आज वसूला', months: 'महीने बाकी', received: 'मिल गया', cash: 'नकद', upi: 'UPI', other: 'दूसरी रकम', undo: 'वापस', clear: 'सारी फीस आ चुकी है', retry: 'फिर कोशिश करें', err: 'लोड नहीं हुआ', all: 'पूरा' },
  mr: { title: 'फी', pending: 'बाकी', today: 'आज जमा', months: 'महिने बाकी', received: 'मिळाले', cash: 'रोख', upi: 'UPI', other: 'दुसरी रक्कम', undo: 'परत', clear: 'सर्व फी जमा झाली', retry: 'पुन्हा प्रयत्न करा', err: 'लोड झाले नाही', all: 'सर्व' },
};
