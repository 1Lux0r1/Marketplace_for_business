/**
 * Иконки — инлайновый SVG на 24-сетке, обводкой, одного стиля.
 * Никаких эмодзи и иконочных шрифтов: они не перекрашиваются и не масштабируются.
 */
export type IconProps = { size?: number; className?: string }
type Props = IconProps

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

/* ─── Разделы подрядчика (§7.1) ─── */

export const TagIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M4 11.2V4.5h6.7L20 13.8l-6.7 6.7z" />
    <circle cx="8.2" cy="8.2" r="1.4" />
  </Icon>
)

export const InboxIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M3.5 13.5L6 4.8h12l2.5 8.7V19a1 1 0 01-1 1H4.5a1 1 0 01-1-1z" />
    <path d="M3.5 13.5h4.2l1.3 2.4h6l1.3-2.4h4.2" />
  </Icon>
)

export const ToolIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M17.3 3.4a4.9 4.9 0 00-6.2 6.2l-7 7 3 3 7-7a4.9 4.9 0 006.2-6.2l-3 3-3-3z" />
  </Icon>
)

export const CheckDocIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M6.5 3h6.5l4.5 4.5V21h-11z" />
    <path d="M13 3v4.5h4.5" />
    <path d="M8.8 14.5l2.1 2.1 3.9-4.2" />
  </Icon>
)

export const WalletIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M4 7.6A2.6 2.6 0 016.6 5H18v2.6" />
    <rect x="4" y="7.6" width="16" height="11.4" rx="2.2" />
    <path d="M20 11.6h-3.4a1.9 1.9 0 000 3.8H20" />
  </Icon>
)

/* ─── Разделы оператора (§7.1) ─── */

export const UsersIcon = (p: Props) => (
  <Icon {...p}>
    <circle cx="9.4" cy="8.4" r="3.4" />
    <path d="M3.6 20.2a5.8 5.8 0 0111.6 0" />
    <path d="M16.2 5.4a3.4 3.4 0 010 6.4M17.4 14.8a5.8 5.8 0 013 5.4" />
  </Icon>
)

export const AlertIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M12 4.2l8.6 15.3H3.4z" />
    <path d="M12 10v4.2" />
    <circle cx="12" cy="17.2" r=".95" fill="currentColor" stroke="none" />
  </Icon>
)

export const ChartIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M4 20V4" />
    <path d="M4 20h16" />
    <path d="M8 16.5v-4M12.5 16.5V8M17 16.5v-6.4" />
  </Icon>
)

export const DealIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M4 9h13.5l-3.2-3.2" />
    <path d="M20 15H6.5l3.2 3.2" />
  </Icon>
)

/**
 * Реестр иконок: имя → рисунок.
 *
 * Нужен, чтобы данные могли ссылаться на иконку, не завися от разметки.
 * Меню разделов (`src/app/sections.ts`) — это знание о предметной области:
 * как называются задачи человека и кто что видит. Оно проверяется тестом
 * без React и без браузера, а для этого не должно тянуть за собой `.tsx`.
 */
export const icons = {
  search: SearchIcon,
  bag: BagIcon,
  doc: DocIcon,
  building: BuildingIcon,
  lock: LockIcon,
  shield: ShieldIcon,
  tag: TagIcon,
  inbox: InboxIcon,
  tool: ToolIcon,
  checkDoc: CheckDocIcon,
  wallet: WalletIcon,
  users: UsersIcon,
  alert: AlertIcon,
  chart: ChartIcon,
  deal: DealIcon,
} as const

export type IconName = keyof typeof icons
