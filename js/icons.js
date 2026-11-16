// Small inline SVG icon set (stroke icons on a 24px grid, in the spirit of SF Symbols).

const paths = {
  summary: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v4.5l3 2"/>',
  rings: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>',
  dumbbell: '<path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4v4h4"/><path d="M12 8v4.2l2.8 1.8"/>',
  chart: '<path d="M4 19.5h16"/><path d="M5 15.5l4.5-5 3.5 3 6-7"/><path d="M15 6.5h4v4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chevronRight: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
  chevronLeft: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  chevronDown: '<path d="M5.5 9.5L12 16l6.5-6.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  more: '<circle cx="5.5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor"/>',
  trophy: '<path d="M7.5 4.5h9v5a4.5 4.5 0 0 1-9 0v-5z"/><path d="M7.5 6.5H4.5v1.5a3 3 0 0 0 3 3M16.5 6.5h3v1.5a3 3 0 0 1-3 3"/><path d="M12 14v3.5M8.5 20h7M9.5 17.5h5"/>',
  flame: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.1 0-3.4 2.4-5.4 3.6-7.8.3 1.7 1.2 2.9 2.4 3.6.1-3.2 1.6-5.7 3.6-7.2-.3 2.6.6 4.5 1.9 6.1 1.1 1.4 1.5 2.9 1.5 4.6 0 4.2-2.6 6.8-6.5 6.8z"/>',
  trash: '<path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13h9l1-13M10 10.5v6M14 10.5v6"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M9.5 2.5h5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
  arrowUp: '<path d="M12 19V6M6.5 11.5L12 6l5.5 5.5"/>',
  arrowDown: '<path d="M12 5v13M6.5 12.5L12 18l5.5-5.5"/>',
  grip: '<path d="M5 9h14M5 15h14"/>',
  share: '<path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M7 10.5H5.5v10h13v-10H17"/>',
  addSquare: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M12 8.5v7M8.5 12h7"/>',
  download: '<path d="M12 4v11M8 11l4 4 4-4"/><path d="M5 19.5h14"/>',
  upload: '<path d="M12 15.5v-11M8 8.5l4-4 4 4"/><path d="M5 19.5h14"/>',
  edit: '<path d="M14.5 5.5l4 4L9 19H5v-4z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.75" cy="6.5" r="1" fill="currentColor"/><circle cx="4.75" cy="12" r="1" fill="currentColor"/><circle cx="4.75" cy="17.5" r="1" fill="currentColor"/>',
  sparkle: '<path d="M12 3.5l1.8 5 5 1.8-5 1.8-1.8 5-1.8-5-5-1.8 5-1.8z"/>',
  bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
};

export function icon(name, { size = 22, cls = '', stroke = 2 } = {}) {
  const body = paths[name] || '';
  return `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
