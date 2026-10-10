// The pencil case, drawn as line icons. Each takes its colour from the button
// (currentColor); the pen and marker tips also take the chosen ink, via --ink.

const svg = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

export function PenIcon() {
  return (
    <svg {...svg}>
      <path d="M15.5 4.5l4 4L9 19l-5 1 1-5z" />
      <path d="M5 15l4 4" fill="var(--ink, currentColor)" />
      <path d="M4.2 19.8L5 15l4 4z" fill="var(--ink, currentColor)" stroke="none" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  )
}

export function MarkerIcon() {
  return (
    <svg {...svg}>
      <path d="M14 4l6 6-7.5 7.5-6-6z" />
      <path d="M6.5 11.5L4 17l3 3 5.5-2.5" />
      <path d="M4 17l3 3-3.5.6z" fill="var(--ink, currentColor)" stroke="none" />
      <path d="M3 21.5h8" stroke="var(--ink, currentColor)" strokeWidth={2.4} />
    </svg>
  )
}

export function EraserIcon() {
  return (
    <svg {...svg}>
      <path d="M8.5 19.5L3.8 14.8a1.6 1.6 0 010-2.3L12.5 3.8a1.6 1.6 0 012.3 0l5.4 5.4a1.6 1.6 0 010 2.3l-8 8z" />
      <path d="M8.2 8.2l7.6 7.6" />
      <path d="M8.5 19.5H20" />
    </svg>
  )
}

export function UndoIcon() {
  return (
    <svg {...svg}>
      <path d="M9 7L4.5 11.5 9 16" />
      <path d="M4.5 11.5H14a5.5 5.5 0 010 11h-2" transform="translate(0 -3)" />
    </svg>
  )
}

export function RedoIcon() {
  return (
    <svg {...svg}>
      <path d="M15 7l4.5 4.5L15 16" />
      <path d="M19.5 11.5H10a5.5 5.5 0 000 11h2" transform="translate(0 -3)" />
    </svg>
  )
}

export function TrashIcon() {
  return (
    <svg {...svg}>
      <path d="M4.5 7h15" />
      <path d="M9.5 7V4.8h5V7" />
      <path d="M6.5 7l1 12.2h9l1-12.2" />
      <path d="M10.2 10.5v5.5M13.8 10.5v5.5" />
    </svg>
  )
}

export function PencilIcon() {
  return (
    <svg {...svg}>
      <path d="M16.5 3.5l4 4L8 20H4v-4z" />
      <path d="M14 6l4 4" />
    </svg>
  )
}
