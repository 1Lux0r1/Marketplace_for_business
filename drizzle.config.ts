import { defineConfig } from 'drizzle-kit'

// Схема на модуль (§4.1). schemaFilter перечисляет их явно, иначе drizzle-kit
// смотрит только в public и «не видит» ничего из наших схем.
export default defineConfig({
  schema: './src/modules/*/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  schemaFilter: [
    'platform', 'catalog', 'intake', 'matching', 'deal',
    'documents', 'payments', 'notifications', 'analytics',
  ],
  verbose: true,
  strict: true,
})
