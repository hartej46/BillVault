import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { SCHEMA_SQL } from './schema'

let db: Database.Database | null = null

export function initDatabase(): Database.Database {
  if (db) return db

  const userDataPath = app ? app.getPath('userData') : process.cwd()
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true })
  }

  const dbPath = join(userDataPath, 'billsort.db')
  console.log(`[DB] Initializing SQLite database at: ${dbPath}`)

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Run initial schema
  db.exec(SCHEMA_SQL)

  // Seed default settings if not exists
  const countSettings = (db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number }).count
  if (countSettings === 0) {
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
    insertSetting.run('model_name', 'qwen2.5vl:7b')
    insertSetting.run('buyer_gstin', '')
    insertSetting.run('buyer_state', '27') // Maharashtra default, editable
    insertSetting.run('theme', 'dark')
  }

  return db
}

export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase()
  }
  return db
}
