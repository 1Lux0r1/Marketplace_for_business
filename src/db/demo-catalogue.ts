/**
 * Демонстрационный каталог: единственный источник выдуманных данных.
 *
 * ВНИМАНИЕ, ЧТО ЗДЕСЬ ПРАВДА, А ЧТО ВЫДУМАНО:
 *
 * - **Категории — настоящие.** Двенадцать направлений первой волны
 *   из `docs/05-sprint-01.md`.
 * - **Зоны — настоящие.** Административные округа Москвы.
 * - **Компании, люди, цены и сроки — ВЫДУМАНЫ.** Правдоподобны, но взяты
 *   из головы: рыночных ставок по этим услугам у нас нет (§9.7). Ни одна
 *   цифра отсюда не годится для расчётов, коммерческих предложений
 *   и разговоров с инвестором.
 *
 * Названия компаний нарочно начинаются со слова «Демо» — чтобы через полгода
 * никто не принял эти строки за настоящих подрядчиков.
 *
 * Читают этот файл двое, и поэтому он существует отдельно:
 *
 * - `src/db/seed.ts` засевает этим базу для разработки (`pnpm db:seed`);
 * - `src/server/storefront-queries.demo.ts` показывает это на витрине демо
 *   для GitHub Pages, где базы нет вовсе.
 *
 * Пока данные лежали внутри сида, витрина демо была пустой. Копия этих же
 * цифр во втором файле разошлась бы с первым молча, и демо показывало бы
 * цены, которых в базе уже нет.
 */

export type CategorySeed = { code: string; name: string; kind: 'service' | 'goods'; sortOrder: number }

export const CATEGORIES: CategorySeed[] = [
  { code: 'sanitation', name: 'Санобработка', kind: 'service', sortOrder: 10 },
  { code: 'disinsection', name: 'Дезинсекция', kind: 'service', sortOrder: 20 },
  { code: 'deratization', name: 'Дератизация', kind: 'service', sortOrder: 30 },
  { code: 'cleaning', name: 'Клининг', kind: 'service', sortOrder: 40 },
  { code: 'hvac', name: 'Вентиляция и кондиционирование', kind: 'service', sortOrder: 50 },
  { code: 'electrical', name: 'Электрика', kind: 'service', sortOrder: 60 },
  { code: 'plumbing', name: 'Сантехника', kind: 'service', sortOrder: 70 },
  { code: 'labour-safety', name: 'Охрана труда', kind: 'service', sortOrder: 80 },
  { code: 'sout', name: 'СОУТ', kind: 'service', sortOrder: 90 },
  { code: 'fire-safety', name: 'Пожарная безопасность', kind: 'service', sortOrder: 100 },
  { code: 'prof-chemistry', name: 'Профхимия', kind: 'goods', sortOrder: 110 },
  { code: 'supplies', name: 'Расходники', kind: 'goods', sortOrder: 120 },
]

/** Подрядчики. Всё выдумано: и компании, и люди, и рейтинги. */
export const CONTRACTORS = [
  {
    name: 'Демо-СанПро',
    inn: '7701000001',
    person: 'Игорь Соколов',
    email: 'demo-sanpro@example.ru',
    phone: '+79160000001',
    rating: 5,
    categories: ['sanitation', 'disinsection', 'deratization'],
    zones: ['msk-cao', 'msk-sao', 'msk-svao'],
  },
  {
    name: 'Демо-Чистый Свет',
    inn: '7701000019',
    person: 'Марина Гущина',
    email: 'demo-cleaning@example.ru',
    phone: '+79160000002',
    rating: 4,
    categories: ['cleaning'],
    zones: ['msk'],
  },
  {
    name: 'Демо-Инженерка',
    inn: '7701000026',
    person: 'Павел Тарасов',
    email: 'demo-eng@example.ru',
    phone: '+79160000003',
    rating: 4,
    categories: ['hvac', 'electrical', 'plumbing'],
    zones: ['msk-cao', 'msk-zao', 'msk-uzao'],
  },
  {
    name: 'Демо-Охрана труда',
    inn: '7701000033',
    person: 'Елена Бирюкова',
    email: 'demo-safety@example.ru',
    phone: '+79160000004',
    rating: 3,
    categories: ['labour-safety', 'sout', 'fire-safety'],
    zones: ['msk'],
  },
  {
    name: 'Демо-Снабжение',
    inn: '7701000040',
    person: 'Артём Логинов',
    email: 'demo-supply@example.ru',
    phone: '+79160000005',
    rating: 4,
    categories: ['prof-chemistry', 'supplies'],
    zones: ['msk'],
    status: 'paused' as const,
  },
]

/** Карточки каталога. Цены ВЫДУМАНЫ, см. предупреждение наверху файла. */
export const LISTINGS: Record<string, Array<{
  category: string
  title: string
  unit: string
  rubles: number
  leadHours: number
  description: string
}>> = {
  'Демо-СанПро': [
    {
      category: 'sanitation',
      title: 'Санобработка помещения до 100 м²',
      unit: 'объект',
      rubles: 4500,
      leadHours: 24,
      description: 'Обработка зала и подсобных помещений. Договор, акт, отчётные документы.',
    },
    {
      category: 'disinsection',
      title: 'Дезинсекция от тараканов, кухня',
      unit: 'объект',
      rubles: 6200,
      leadHours: 12,
      description: 'Гелевая обработка без запаха, работа ночью. Повторный выезд через 14 дней.',
    },
  ],
  'Демо-Чистый Свет': [
    {
      category: 'cleaning',
      title: 'Генеральная уборка после ремонта',
      unit: 'м2',
      rubles: 180,
      leadHours: 48,
      description: 'Мойка окон, вынос строительного мусора, финишная уборка.',
    },
    {
      category: 'cleaning',
      title: 'Ежедневная уборка торгового зала',
      unit: 'час',
      rubles: 650,
      leadHours: 24,
      description: 'Клинер с расходниками. От четырёх часов в смену.',
    },
  ],
  'Демо-Инженерка': [
    {
      category: 'hvac',
      title: 'Чистка и обслуживание вытяжки на кухне',
      unit: 'объект',
      rubles: 12000,
      leadHours: 72,
      description: 'Разбор, промывка зонта и воздуховодов, замер тяги, протокол.',
    },
    {
      category: 'electrical',
      title: 'Замена электрощита на объекте',
      unit: 'объект',
      rubles: 28000,
      leadHours: 96,
      description: 'Щит, автоматы, УЗО, маркировка линий, исполнительная схема.',
    },
  ],
  'Демо-Охрана труда': [
    {
      category: 'sout',
      title: 'СОУТ рабочего места',
      unit: 'шт',
      rubles: 1800,
      leadHours: 168,
      description: 'Замеры, отчёт, подача сведений в реестр. От пяти рабочих мест.',
    },
    {
      category: 'labour-safety',
      title: 'Обучение по охране труда, один сотрудник',
      unit: 'шт',
      rubles: 2400,
      leadHours: 72,
      description: 'Дистанционно, с протоколом и удостоверением.',
    },
  ],
}
