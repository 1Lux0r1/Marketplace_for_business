/**
 * Иконки — инлайновый SVG на 24-сетке, обводкой, одного стиля.
 * Никаких эмодзи и иконочных шрифтов: они не перекрашиваются и не масштабируются.
 */
type Props = { size?: number; className?: string }

function Icon({ size = 20, className, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  )
}

export const SearchIcon = (p: Props) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </Icon>
)

export const BagIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M4.5 8h15l-1.2 12.5H5.7z" />
    <path d="M8.8 8V6.2a3.2 3.2 0 016.4 0V8" />
  </Icon>
)

export const DocIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M6.5 3h6.5l4.5 4.5V21h-11z" />
    <path d="M13 3v4.5h4.5" />
    <path d="M9 13h6M9 16.5h4" />
  </Icon>
)

export const BuildingIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M4 21V6.4l7.5-3.2V21" />
    <path d="M11.5 10.2H20V21" />
    <path d="M7 9.5h1.4M7 13h1.4M7 16.5h1.4M15 14h1.4M15 17.5h1.4" />
  </Icon>
)

export const LockIcon = (p: Props) => (
  <Icon {...p}>
    <rect x="4.8" y="10.4" width="14.4" height="10" rx="2.2" />
    <path d="M8.4 10.4V8a3.6 3.6 0 017.2 0v2.4" />
  </Icon>
)

export const ShieldIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M12 3l7 3v6c0 4.2-2.9 7.9-7 9-4.1-1.1-7-4.8-7-9V6l7-3z" />
    <path d="M9.4 12.2l1.9 1.9 3.4-3.7" />
  </Icon>
)
