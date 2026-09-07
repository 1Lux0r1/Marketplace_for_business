import { cx } from './cx'

/**
 * Отраслевая иллюстрация на карточке услуги.
 *
 * Витрина продаёт, а карточка без картинки продаёт плохо: взгляд не за что
 * зацепить, и двадцать карточек читаются как список строк (§7). Но и фотографии
 * тут не годятся — их неоткуда взять, они весят, и у двенадцати категорий
 * они будут разного качества и настроения.
 *
 * Поэтому рисунок, а не растр: перекрашивается вместе с темой, ничего не весит
 * и не требует внешних запросов, которые всё равно заблокированы (`design/README.md`).
 *
 * Рисунок один на категорию и берётся по её коду. Незнакомый код — нейтральный
 * рисунок, а не пустое место: карточка не должна ломаться из-за новой категории,
 * заведённой оператором.
 */
type Props = { categoryCode: string; className?: string }

/**
 * Тон категории — из декоративной палитры, а не из статусной.
 *
 * Первый вариант красил по смыслу: электрику оранжевым, пожарную безопасность
 * красным, охрану труда зелёным. Это было ошибкой — рядом на витрине стоят
 * настоящие бейджи этих цветов, и один цвет с двумя смыслами не читается
 * ни тем ни другим (§7.2).
 *
 * Решение не «убрать цвет», а завести цвету другую роль. Тона `--deco-*`
 * ничего не означают: они просто различают санобработку и электрику. Каждый
 * отстоит от любого статусного не меньше чем на 25° по цветовому кругу,
 * и это проверяет `tokens.test.ts` — иначе лаймовая плашка со временем
 * начнёт читаться как «ждём приёмки».
 *
 * Родственные категории делят тон намеренно: санобработка, дезинсекция
 * и дератизация — одна работа для владельца точки, и на витрине они должны
 * выглядеть роднёй.
 */
const TONE: Record<string, string> = {
  sanitation: 'bg-deco-2 text-deco-2-ink',
  disinsection: 'bg-deco-2 text-deco-2-ink',
  deratization: 'bg-deco-2 text-deco-2-ink',
  cleaning: 'bg-deco-1 text-deco-1-ink',
  'prof-chemistry': 'bg-deco-1 text-deco-1-ink',
  supplies: 'bg-deco-1 text-deco-1-ink',
  hvac: 'bg-deco-3 text-deco-3-ink',
  electrical: 'bg-deco-3 text-deco-3-ink',
  plumbing: 'bg-deco-3 text-deco-3-ink',
  'labour-safety': 'bg-deco-4 text-deco-4-ink',
  sout: 'bg-deco-4 text-deco-4-ink',
  'fire-safety': 'bg-deco-5 text-deco-5-ink',
}

/** Незнакомая категория — нейтральная подложка, а не пустое место. */
const FALLBACK = 'bg-surface-3 text-ink-2'

function Art({ code }: { code: string }) {
  switch (code) {
    case 'sanitation':
    case 'disinsection':
      // Распылитель: обработка помещения
      return (
        <>
          <path d="M28 20h10v6H28z" />
          <path d="M30 26v6l-5 4v22a3 3 0 003 3h8a3 3 0 003-3V36l-5-4v-6" />
          <path d="M38 23h7l4-4M45 27h6M45 31h4" />
          <circle cx="53" cy="19" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="56" cy="26" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="51" cy="35" r="1.6" fill="currentColor" stroke="none" />
        </>
      )
    case 'deratization':
      // Ловушка и след
      return (
        <>
          <rect x="20" y="34" width="30" height="20" rx="3" />
          <path d="M20 42h30" />
          <circle cx="42" cy="48" r="2.4" />
          <path d="M56 30c3 0 5 2 5 5s-2 5-5 5" />
          <circle cx="58" cy="24" r="2" />
          <circle cx="64" cy="27" r="2" />
        </>
      )
    case 'cleaning':
      // Швабра и ведро
      return (
        <>
          <path d="M24 18v24" />
          <path d="M16 42h16l-2 12H18z" />
          <path d="M44 34h20l-2 22H46z" />
          <path d="M44 34c0-3 4-5 10-5s10 2 10 5" />
        </>
      )
    case 'hvac':
      // Вытяжка и поток воздуха
      return (
        <>
          <path d="M16 20h32v14H16z" />
          <path d="M22 34v6M34 34v6M42 34v6" />
          <path d="M56 26c4 0 4 5 0 5s-4 5 0 5" />
          <path d="M64 20c4 0 4 5 0 5s-4 5 0 5" />
        </>
      )
    case 'electrical':
      // Молния в щитке
      return (
        <>
          <rect x="22" y="16" width="36" height="44" rx="4" />
          <path d="M42 26l-10 14h8l-2 12 10-14h-8z" />
        </>
      )
    case 'plumbing':
      // Труба с вентилем и капля
      return (
        <>
          <path d="M16 30h14v14H16z" />
          <path d="M30 37h14M44 26v22M44 30h16" />
          <circle cx="44" cy="22" r="4" />
          <path d="M62 40c3 4 5 6 5 8a5 5 0 01-10 0c0-2 2-4 5-8z" />
        </>
      )
    case 'labour-safety':
      // Каска
      return (
        <>
          <path d="M16 48h48" />
          <path d="M20 48c0-12 9-20 20-20s20 8 20 20" />
          <path d="M34 29v-5h12v5" />
          <path d="M40 28v20" />
        </>
      )
    case 'sout':
      // Планшет с оценкой
      return (
        <>
          <rect x="24" y="14" width="32" height="46" rx="4" />
          <path d="M32 12h16v6H32z" />
          <path d="M32 32h16M32 40h12" />
          <path d="M32 48l4 4 8-9" />
        </>
      )
    case 'fire-safety':
      // Огнетушитель
      return (
        <>
          <rect x="30" y="26" width="20" height="34" rx="5" />
          <path d="M34 26v-5h12v5" />
          <path d="M46 24h8v6" />
          <path d="M30 38h20" />
        </>
      )
    case 'prof-chemistry':
      // Канистра с меткой
      return (
        <>
          <path d="M26 26h24v34H26z" />
          <path d="M32 26v-6h12v6" />
          <path d="M32 38h12M32 46h8" />
          <path d="M58 30l6 6-6 6-6-6z" />
        </>
      )
    case 'supplies':
      // Коробка
      return (
        <>
          <path d="M18 28l22-10 22 10-22 10z" />
          <path d="M18 28v22l22 10 22-10V28" />
          <path d="M40 38v22" />
        </>
      )
    default:
      // Неизвестная категория: нейтральная метка, а не пустое место
      return (
        <>
          <path d="M20 28h28l12 12-24 22-16-16z" />
          <circle cx="30" cy="36" r="3" />
        </>
      )
  }
}

export function CategoryArt({ categoryCode, className }: Props) {
  return (
    <div
      aria-hidden
      className={cx(
        'flex items-center justify-center overflow-hidden',
        TONE[categoryCode] ?? FALLBACK,
        className,
      )}
    >
      <svg
        width="96"
        height="80"
        viewBox="0 0 80 72"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-90"
      >
        <Art code={categoryCode} />
      </svg>
    </div>
  )
}

/**
 * Подпись категории в тоне её иллюстрации.
 *
 * Картинка и подпись под ней должны читаться как одно целое: серая надпись
 * под цветной плашкой выглядит ярлыком, наклеенным поверх чужой карточки.
 */
export function CategoryLabel({
  categoryCode,
  children,
}: {
  categoryCode: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cx(
        'text-label font-bold tracking-[0.08em] uppercase',
        LABEL[categoryCode] ?? 'text-ink-3',
      )}
    >
      {children}
    </span>
  )
}

const LABEL: Record<string, string> = {
  sanitation: 'text-deco-2-ink',
  disinsection: 'text-deco-2-ink',
  deratization: 'text-deco-2-ink',
  cleaning: 'text-deco-1-ink',
  'prof-chemistry': 'text-deco-1-ink',
  supplies: 'text-deco-1-ink',
  hvac: 'text-deco-3-ink',
  electrical: 'text-deco-3-ink',
  plumbing: 'text-deco-3-ink',
  'labour-safety': 'text-deco-4-ink',
  sout: 'text-deco-4-ink',
  'fire-safety': 'text-deco-5-ink',
}
