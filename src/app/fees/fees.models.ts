import { signal } from '@angular/core';

export type Mode = 'cash' | 'upi';
export type Lang = 'en' | 'hi' | 'mr';

/** One pending student row. Money is always in paise. */
export interface Row {
  id: string;
  name: string;
  cls: string;
  vehicle: string;
  veh: string;
  months: number;
  balance: number;
  steps: number[];
  since: string;
}

/** Read-only fee statement for one student (parent view). */
export interface Statement {
  name: string;
  balance: number;
  rows: { per: string; amt: number; paid: number }[];
}

export const money = (p: number): string => '₹' + (p / 100).toLocaleString('en-IN');

export const T: Record<Lang, Record<string, string>> = {
  en: {
    title: 'Fees',
    pending: 'Pending',
    today: 'Collected today',
    months: 'months pending',
    received: 'Received',
    cash: 'Cash',
    upi: 'UPI',
    other: 'Other amount',
    undo: 'UNDO',
    clear: 'All fees are collected',
    retry: 'Try again',
    err: 'Could not load',
    all: 'All',
    students: 'Students',
    trip: 'Trip',
    start: 'Start trip',
    end: 'Reached school',
    picked: 'Picked up',
    notComing: 'Not coming',
    add: 'Add student',
    search: 'Search',
    notGoing: 'Not going today',
  },
  hi: {
    title: 'फीस',
    pending: 'बाकी',
    today: 'आज वसूला',
    months: 'महीने बाकी',
    received: 'मिल गया',
    cash: 'नकद',
    upi: 'UPI',
    other: 'दूसरी रकम',
    undo: 'वापस',
    clear: 'सारी फीस आ चुकी है',
    retry: 'फिर कोशिश करें',
    err: 'लोड नहीं हुआ',
    all: 'पूरा',
    students: 'बच्चे',
    trip: 'ट्रिप',
    start: 'ट्रिप शुरू',
    end: 'स्कूल पहुँचे',
    picked: 'बैठ गया',
    notComing: 'नहीं आ रहा',
    add: 'बच्चा जोड़ें',
    search: 'खोजें',
    notGoing: 'आज नहीं जाएगा',
  },
  mr: {
    title: 'फी',
    pending: 'बाकी',
    today: 'आज जमा',
    months: 'महिने बाकी',
    received: 'मिळाले',
    cash: 'रोख',
    upi: 'UPI',
    other: 'दुसरी रक्कम',
    undo: 'परत',
    clear: 'सर्व फी जमा झाली',
    retry: 'पुन्हा प्रयत्न करा',
    err: 'लोड झाले नाही',
    all: 'सर्व',
    students: 'विद्यार्थी',
    trip: 'ट्रिप',
    start: 'ट्रिप सुरू',
    end: 'शाळेत पोहोचलो',
    picked: 'बसला',
    notComing: 'येत नाही',
    add: 'विद्यार्थी जोडा',
    search: 'शोधा',
    notGoing: 'आज जाणार नाही',
  },
};

/** Language chosen in the profile bar. Signal-backed so every template that reads it updates (the app runs zoneless). */
const read = (): Lang => {
  try {
    return (localStorage.getItem('lang') as Lang) || 'en';
  } catch {
    return 'en';
  }
};
const lang = signal<Lang>(read());
export const L = (): Lang => lang();
export const setLang = (l: Lang): void => {
  lang.set(l);
  try {
    localStorage.setItem('lang', l);
  } catch {
    /* storage unavailable: language lasts until reload */
  }
};
