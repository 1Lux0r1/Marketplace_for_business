import { z } from 'zod'
import * as platform from '@/modules/platform'
import { PASSWORD_MAX_LENGTH } from '@/shared/password'

/**
 * Схемы форм входа и регистрации.
 *
 * Отдельным файлом от команд по двум причинам. Первая: в файле с `'use server'`
 * наружу можно отдавать только асинхронные функции, а схему надо уметь
 * проверить тестом. Вторая: именно здесь ломалась регистрация физлица —
 * форма не показывала поле, а схема его требовала, и человек получал ошибку
 * про поле, которого нет на экране. Такое место должно быть закрыто тестом.
 */

/**
 * Что требуется от формы, зависит от формы собственности.
 *
 * Физлицо не вводит ни ИНН, ни название: этих полей у него на экране нет,
 * и требовать их значит отвечать ошибкой про поле, которого человек не видит.
 * Название ему заменяет собственное имя — его подставляет `registerAction`.
 */
export const registerSchema = z
  .object({
    legalForm: z.enum(['individual', 'sole_trader', 'company']),
    companyName: z
      .string()
      .trim()
      .max(platform.LIMITS.orgName, 'Название слишком длинное — оно не поместится в документы')
      .optional(),
    inn: z.string().trim().max(20, 'В ИНН не больше 12 цифр').optional(),
    fullName: z
      .string()
      .trim()
      .min(3, 'Укажите фамилию и имя')
      .max(platform.LIMITS.fullName, 'Слишком длинно для фамилии и имени'),
    position: z
      .string()
      .trim()
      .max(platform.LIMITS.position, 'Название должности слишком длинное')
      .optional(),
    email: z
      .email('Проверьте адрес почты: похоже, в нём опечатка')
      .max(platform.LIMITS.email, 'Адрес почты слишком длинный'),
    phone: z
      .string()
      .trim()
      .min(1, 'Телефон нужен: по нему с вами свяжется подрядчик')
      .max(30, 'Проверьте телефон: слишком много знаков'),
    password: z.string().max(PASSWORD_MAX_LENGTH, `Пароль длиннее ${PASSWORD_MAX_LENGTH} символов`),
  })
  .superRefine((data, ctx) => {
    if (data.legalForm === 'individual') return

    if (!data.companyName || data.companyName.length < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['companyName'],
        message: 'Укажите название — по нему вас найдут заказчики',
      })
    }
    if (!data.inn) {
      ctx.addIssue({
        code: 'custom',
        path: ['inn'],
        message: 'Укажите ИНН: без него мы не выпустим ни договор, ни счёт',
      })
    }
  })

export const resendSchema = z.object({
  email: z.email('Проверьте адрес почты: похоже, в нём опечатка'),
})

export const loginSchema = z.object({
  login: z.string().trim().min(1, 'Введите почту или телефон').max(254, 'Проверьте логин'),
  // Верхняя граница здесь не про надёжность, а про то, чтобы проверка пароля
  // не превращалась в работу по гигабайту присланного текста
  password: z.string().min(1, 'Введите пароль').max(PASSWORD_MAX_LENGTH, 'Не подходит логин или пароль'),
  remember: z.boolean(),
})

export const verifySchema = z.object({
  email: z.email('Проверьте адрес почты: похоже, в нём опечатка'),
  code: z.string().trim().min(1, 'Введите код из письма'),
})

/**
 * Пароль по ссылке из приглашения (задача 02-3).
 *
 * Верхняя граница пароля — та же, что и на входе: проверка не должна
 * превращаться в работу по гигабайту присланного текста. Нижнюю ставит
 * не схема, а модуль: правило «от десяти символов» одно на всю систему,
 * и дублировать его здесь значило бы завести второе место, где его менять.
 */
export const setPasswordSchema = z.object({
  token: z.string().trim().min(10, 'Ссылка не подходит. Проверьте, что скопировали её целиком.'),
  password: z.string().min(1, 'Придумайте пароль').max(PASSWORD_MAX_LENGTH, 'Пароль слишком длинный'),
})
