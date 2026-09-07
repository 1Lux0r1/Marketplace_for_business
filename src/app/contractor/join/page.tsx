import { JoinForm } from './join-form'

/**
 * «Стать подрядчиком». Публичная страница: человек ещё никто в системе.
 *
 * Данных отсюда не читается вовсе, поэтому заглушка для демо не нужна —
 * страница собирается и в наборе файлов без базы.
 */
export default function JoinPage() {
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-page font-extrabold">Стать подрядчиком</h1>
        <p className="max-w-[70ch] text-body text-ink-2">
          Заказы приходят из каталога: вы публикуете услуги с ценой, клиент выбирает
          и оплачивает площадке. Деньги мы удерживаем до подписания акта — вам не нужно
          выбивать оплату, но и получить её раньше приёмки нельзя.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-section font-extrabold">Что дальше</h2>
        <ol className="flex max-w-[70ch] list-decimal flex-col gap-2 pl-5 text-body text-ink-2">
          <li>Заполняете форму — заявка принята сразу, ждать ничего не нужно.</li>
          <li>Мы проверяем ИНН. Если справочник не ответит, заявку посмотрит наш сотрудник.</li>
          <li>После проверки вы публикуете карточки услуг, и они попадают в каталог.</li>
        </ol>
      </section>

      <JoinForm />
    </>
  )
}
