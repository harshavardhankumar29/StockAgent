import { PrismaClient } from '@/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import path from 'path'

// ⚠️ TODO: SQLite is ephemeral on serverless platforms (Vercel, AWS Lambda).
// The dev.db file will silently disappear or behave inconsistently across
// function instances. Before deploying to production, migrate to hosted
// Postgres (Neon/Supabase both have free tiers):
//   1. Change schema.prisma: provider = "postgresql", add url = env("DATABASE_URL")
//   2. Replace this file with: new PrismaClient() (no adapter needed)
//   3. Remove better-sqlite3 and @prisma/adapter-better-sqlite3 from package.json
//   4. Set DATABASE_URL in your deployment environment
const prismaClientSingleton = () => {
  const dbPath = path.join(process.cwd(), 'dev.db')
  const adapter = new PrismaBetterSqlite3({ url: 'file:' + dbPath })
  return new PrismaClient({ adapter })
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
