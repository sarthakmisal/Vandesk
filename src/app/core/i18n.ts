import { signal } from '@angular/core';

export type Lang = 'en' | 'hi' | 'mr';

export interface Strings {
  title: string;
  pending: string;
  today: string;
  months: string;
  received: string;
  cash: string;
  upi: string;
  other: string;
  undo: string;
  clear: string;
  retry: string;
  err: string;
  all: string;
  students: string;
  trip: string;
  start: string;
  end: string;
  picked: string;
  notComing: string;
  add: string;
  search: string;
  notGoing: string;
  ledger: string;
  dropped: string;
  notHere: string;
  allDone: string;
  finish: string;
  next: string;
  menu: string;
}

export const T: Record<Lang, Strings> = {
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
    ledger: 'Ledger',
    dropped: 'Dropped',
    notHere: 'Not here',
    allDone: 'All students done',
    finish: 'Finish trip',
    next: 'Next',
    menu: 'Menu',
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
    ledger: 'खाता',
    dropped: 'छोड़ दिया',
    notHere: 'नहीं मिला',
    allDone: 'सभी बच्चे हो गए',
    finish: 'ट्रिप खत्म',
    next: 'अगला',
    menu: 'मेन्यू',
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
    ledger: 'खाते',
    dropped: 'सोडले',
    notHere: 'नाही भेटला',
    allDone: 'सर्व विद्यार्थी झाले',
    finish: 'ट्रिप संपली',
    next: 'पुढचा',
    menu: 'मेनू',
  },
};

const read = (): Lang => {
  try {
    return (localStorage.getItem('lang') as Lang | null) ?? 'en';
  } catch {
    return 'en';
  }
};

/** Signal-backed so every template that reads it updates (the app runs zoneless). */
const lang = signal<Lang>(read());
export const L = (): Lang => lang();
export const setLang = (l: Lang): void => {
  lang.set(l);
  try {
    localStorage.setItem('lang', l);
  } catch {
    /* storage unavailable: keep in memory only */
  }
};
