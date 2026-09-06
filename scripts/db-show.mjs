/**
 * Что сейчас в базе — человеческим языком.
 *
 * Нужно для одного вопроса, который возникает чаще всех остальных:
 * «я зарегистрировался, всё ли записалось?». Ответить на него, не открывая
 * отдельную программу для баз данных, дешевле и понятнее.
 *
 * Это не замена интерфейсу администратора (спринт 03) и не часть продукта:
 * обслуживающий скрипт, поэтому читает таблицы напрямую. Между схемами
 * не соединяет — каждый запрос живёт в своей (§4.2).
 */
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL не задан. Сначала запустите настройку: setup.bat')
  process.exit(1)
}

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} })

try {
  const [orgs] = await sql`
    select count(*)::int as всего,
           count(*) filter (where is_client)::int as заказчики,
           count(*) filter (where is_contractor)::int as подрядчики
    from platform.orgs`

  const [users] = await sql`
    select count(*)::int as всего,
           count(*) filter (where email_verified_at is not null)::int as подтверждены
    from platform.users`

  const [sessions] = await sql`
    select count(*)::int as всего from platform.sessions where expires_at > now()`

  const [letters] = await sql`
    select count(*)::int as всего,
           count(*) filter (where status = 'failed')::int as не_дошли
    from notifications.messages`

  console.log(`
Компании        ${orgs.всего}  (заказчиков ${orgs.заказчики}, подрядчиков ${orgs.подрядчики})
Люди            ${users.всего}  (подтвердили почту ${users.подтверждены})
Активных входов ${sessions.всего}
Письма          ${letters.всего}  (не ушло ${letters.не_дошли})`)

  const people = await sql`
    select full_name, email, role, position,
           email_verified_at is not null as подтверждён,
           created_at
    from platform.users
    order by created_at desc
    limit 10`

  if (people.length === 0) {
    console.log('\nПока никто не зарегистрировался.')
  } else {
    console.log('\nКто зарегистрировался последним:\n')
    for (const p of people) {
      const when = p.created_at.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })
      const mark = p.подтверждён ? ' ' : '!'
      const role = p.position ? `${p.role}, ${p.position}` : p.role
      console.log(`  ${mark} ${p.full_name} · ${p.email} · ${role} · ${when}`)
    }
    console.log('\n  «!» — почта не подтверждена, войти такой человек не может.')
  }

  const orgRows = await sql`
    select name, inn, is_client, is_contractor, is_platform
    from platform.orgs order by created_at desc limit 10`

  if (orgRows.length > 0) {
    console.log('\nКомпании:\n')
    for (const o of orgRows) {
      const roles = [
        o.is_platform ? 'площадка' : null,
        o.is_client ? 'заказчик' : null,
        o.is_contractor ? 'подрядчик' : null,
      ].filter(Boolean).join(', ')
      console.log(`  ${o.name}${o.inn ? ` · ИНН ${o.inn}` : ''} · ${roles}`)
    }
  }
  console.log('')
} catch (error) {
  console.error('\nНе получилось прочитать базу.')
  console.error(error instanceof Error ? error.message : String(error))
  console.error('\nПроверьте, что база запущена в панели, и запустите setup.bat.')
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
