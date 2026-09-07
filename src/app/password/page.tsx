import { EmptyState } from '@/ui'
import { isAvailable } from '@/server/company-queries'
import { PasswordForm } from './password-form'

/**
 * «Придумайте пароль» — сюда ведёт ссылка из приглашения.
 *
 * Адрес с `?token=`, а не `/password/<ссылка>`: демо на GitHub Pages
 * собирается без сервера, и адрес с подставляемым куском там требует заранее
 * перечислить все значения — перечислять нечего, и сборка отказывается.
 * ЧТО СДЕЛАТЬ ПОТОМ: вернуть `/password/<ссылка>`, когда демо перестанет
 * быть набором файлов. Это тот же долг, что и у карточки услуги.
 */
export default async function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  if (!isAvailable()) {
    return (
      <EmptyState
        title="Это демо без сервера"
        description="Здесь видно, как выглядит установка пароля по приглашению. На рабочей установке сюда ведёт ссылка из письма."
      />
    )
  }

  const { token } = await searchParams

  if (!token) {
    return (
      <EmptyState
        title="Ссылка неполная"
        description="Похоже, адрес скопировали не целиком. Откройте ссылку из письма ещё раз — она должна открываться одним нажатием."
      />
    )
  }

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-page font-extrabold">Придумайте пароль</h1>
        <p className="max-w-[70ch] text-body text-ink-2">
          Вас пригласили работать с площадкой. Осталось придумать пароль — и вы внутри.
        </p>
      </header>
      <PasswordForm token={token} />
    </>
  )
}
