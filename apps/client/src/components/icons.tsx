// 線條圖示（取代 emoji，風格跟插畫一致）。顏色跟著 currentColor
type P = { className?: string };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  viewBox: "0 0 24 24",
};

export const CameraIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

export const StarIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 3l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L12 15.4 7 18.2l1.2-5.6L4 8.8l5.6-.6z" />
  </svg>
);

export const BooksIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M4 5h5v15H4zM10 5h5v15h-5zM16 6l4 1-3 13-4-1z" />
  </svg>
);

export const BackIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const PlayIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M8 5l11 7-11 7z" fill="currentColor" />
  </svg>
);

export const PauseIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M9 6v12M15 6v12" />
  </svg>
);

export const RepeatIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4" />
  </svg>
);

export const TrashIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
  </svg>
);

export const PlusIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const MinusIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M5 12h14" />
  </svg>
);

export const CheckIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);

export const CloseIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const LockIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export const MoonIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z" />
  </svg>
);

export const MusicIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M9 17V6l10-2v11" />
    <circle cx="6.5" cy="17" r="2.5" />
    <circle cx="16.5" cy="15" r="2.5" />
  </svg>
);

export const MusicOffIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M9 17V6l10-2v11" />
    <circle cx="6.5" cy="17" r="2.5" />
    <circle cx="16.5" cy="15" r="2.5" />
    <path d="M4 4l16 16" />
  </svg>
);
