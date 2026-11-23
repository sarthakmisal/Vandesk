import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** The whole icon set (~20 glyphs, 24x24, stroke). Replaces the ionicons bundle and the emoji. */
const PATHS: Record<string, string> = {
  bus: 'M7 4h10a3 3 0 0 1 3 3v9H4V7a3 3 0 0 1 3-3zM4 11h16M7 16v3M17 16v3',
  wallet: 'M4 7a2 2 0 0 1 2-2h12v3M4 7v10a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6a2 2 0 0 1-2-1M16 13.5h.01',
  users:
    'M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11zM3.5 19a5.5 5.5 0 0 1 11 0M16.5 11a2.6 2.6 0 1 0 0-5.2M17 14.3a4.6 4.6 0 0 1 3.5 4.7',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  logout: 'M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9',
  search: 'M11 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM20 20l-4.2-4.2',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  pin: 'M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  sunrise: 'M12 4v3M5.6 8.6l1.8 1.8M18.4 8.6l-1.8 1.8M3 17h18M7 17a5 5 0 0 1 10 0',
  home: 'M4 11l8-7 8 7M6 10v10h12V10M10 20v-5h4v5',
  flag: 'M6 21V4M6 5h11l-2.5 3.5L17 12H6',
  mail: 'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM4 7.5l8 5.5 8-5.5',
  cash: 'M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  phone: 'M9 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2',
  play: 'M8 5.5v13l10.5-6.5z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  chevron: 'M9 6l6 6-6 6',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  circleCheck: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l3 3 5-6',
};

@Component({
  selector: 'vd-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[style.width.px]': 'size()', '[style.height.px]': 'size()' },
  template: `<svg
    viewBox="0 0 24 24"
    width="100%"
    height="100%"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path [attr.d]="d()" />
  </svg>`,
  styles: ':host{display:inline-flex;flex:none;vertical-align:middle}',
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input(20);
  readonly d = computed(() => PATHS[this.name()] ?? '');
}
