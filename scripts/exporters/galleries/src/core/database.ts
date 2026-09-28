import mysql from 'mysql2/promise'
import type { Hub } from './types.js'

export class Database {
  private connection: mysql.Connection | null = null

  async connect(): Promise<void> {
    this.connection = await mysql.createConnection({
      host: process.env['DB_HOST'] ?? 'localhost',
      port: parseInt(process.env['DB_PORT'] ?? '3306', 10),
      user: process.env['DB_USERNAME'] ?? 'root',
      password: process.env['DB_PASSWORD'] ?? '',
      database: process.env['DB_DATABASE'] ?? 'inventory',
    })
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end()
      this.connection = null
    }
  }

  async query<T>(sql: string, params?: (string | number | null)[]): Promise<T[]> {
    if (!this.connection) {
      throw new Error('Database not connected')
    }
    const [rows] = await this.connection.execute(sql, params)
    return rows as T[]
  }

  /** The hub's own collection, by its backward-compatibility key. */
  async resolveHub(backwardCompatibility: string): Promise<Hub> {
    const rows = await this.query<{ id: string; backward_compatibility: string }>(
      `SELECT id, backward_compatibility FROM collections WHERE backward_compatibility = ?`,
      [backwardCompatibility]
    )
    const row = rows[0]
    if (!row) {
      throw new Error(
        `Hub collection not found: ${backwardCompatibility} — check that the importer's phase 10 ran against this database.`
      )
    }
    return { id: row.id, backwardCompatibility: row.backward_compatibility }
  }

  /** Inventory UUID of a project, by its backward-compatibility key. */
  async resolveProjectId(backwardCompatibility: string): Promise<string> {
    const rows = await this.query<{ id: string }>(
      `SELECT id FROM projects WHERE backward_compatibility = ?`,
      [backwardCompatibility]
    )
    const row = rows[0]
    if (!row) {
      throw new Error(`Project not found: ${backwardCompatibility}`)
    }
    return row.id
  }
}

/**
 * Parses a MySQL JSON column value. mysql2 auto-decodes native JSON columns
 * into JS objects already, so `raw` is usually an object/array, not a string
 * — only fall back to JSON.parse for the (defensive) string case.
 */
export function parseJson<T>(raw: unknown): T | null {
  if (raw == null) return null
  if (typeof raw === 'object') return raw as T
  try {
    return JSON.parse(raw as string) as T
  } catch {
    return null
  }
}
