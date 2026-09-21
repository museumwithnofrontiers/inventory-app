import { writeFile } from 'fs/promises'
import { mkdirSync, createWriteStream } from 'fs'
import { resolve, dirname } from 'path'
import { createGzip } from 'zlib'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import type { ExportContext, ExportResult } from '../core/types.js'

export abstract class BaseExporter {
  protected context: ExportContext
  private _langCodeMap: Map<string, string> | null = null

  constructor(context: ExportContext) {
    this.context = context
  }

  abstract getName(): string
  abstract export(): Promise<ExportResult>

  protected get db() {
    return this.context.db
  }

  protected get gallery() {
    return this.context.gallery
  }

  /** The gallery's item universe. Every exporter scopes its output to this. */
  protected get memberItemIds() {
    return this.context.memberItemIds
  }

  protected get baseUrl() {
    return this.context.baseUrl
  }

  protected get logger() {
    return this.context.logger
  }

  /**
   * Returns a map from language id (3-char ISO, e.g. 'eng') to the 2-char
   * backward_compatibility code used as the key in exported JSON (e.g. 'en').
   * Result is cached within the exporter instance.
   */
  protected async buildLangCodeMap(): Promise<Map<string, string>> {
    if (this._langCodeMap) return this._langCodeMap

    const rows = await this.db.query<{ id: string; backward_compatibility: string | null }>(
      `SELECT id, backward_compatibility FROM languages`
    )
    this._langCodeMap = new Map(
      rows
        .filter(r => r.backward_compatibility !== null)
        .map(r => [r.id, r.backward_compatibility as string])
    )
    return this._langCodeMap
  }

  /** Writes compact JSON + a .gz companion. Creates parent directories as needed. */
  protected async writeJson(filename: string, data: unknown): Promise<void> {
    const filePath = resolve(this.context.outputDir, filename)
    mkdirSync(dirname(filePath), { recursive: true })
    const json = JSON.stringify(data)
    await writeFile(filePath, json, 'utf-8')
    await pipeline(
      Readable.from([Buffer.from(json, 'utf-8')]),
      createGzip(),
      createWriteStream(filePath + '.gz')
    )
  }

  /**
   * Writes one translation file per language under translations/{entityName}.{lang}.json.
   * byLang maps lang code → { [entityId]: stripped translation fields }.
   */
  protected async writeTranslationFiles(
    entityName: string,
    byLang: Map<string, Record<string, unknown>>
  ): Promise<void> {
    for (const [lang, data] of byLang) {
      await this.writeJson(`translations/${entityName}.${lang}.json`, data)
    }
  }

  /** Returns a shallow copy of obj with null-valued and empty-array keys removed. */
  protected stripNulls(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(obj).filter(([, v]) => v !== null && !(Array.isArray(v) && v.length === 0))
    )
  }

  protected placeholders(count: number): string {
    return Array.from({ length: count }, () => '?').join(', ')
  }

  /** Build the public picture URL for a bare filename stored in the DB (e.g. "uuid.jpg"). */
  protected imageUrl(path: string): string {
    return `${this.baseUrl}/pub/${path}`
  }
}
