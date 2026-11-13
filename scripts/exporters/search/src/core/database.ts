import mysql from 'mysql2/promise'

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
}
