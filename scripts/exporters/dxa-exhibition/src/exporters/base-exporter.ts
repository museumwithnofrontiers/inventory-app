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

  protected get exhibition() {
    return this.context.exhibition
  }

  /** The curated theme tree, flat. Nesting is resolved from `parentId`. */
  protected get themes() {
    return this.context.themes
  }

  /** The exhibition's item universe. Every exporter scopes its output to this. */
  protected get memberItemIds() {
    return this.context.memberItemIds
  }

  protected get baseUrl() {
    return this.context.baseUrl
  }

  protected get logger() {
    return this.context.logger
  }

  /** The instance's site slug — `manifest.site.key`. */
  protected get siteKey() {
    return this.context.siteKey
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

  /**
   * The audio and video legacy linked to an exhibition (theme 0) or to a theme
   * (`exhibition_audio`/`exhibition_video` assigned by `theme_audio`/
   * `theme_video`), which the importer files in `collection_media` under
   * `mwnf3_thematic_gallery:theme_<audio|video>:<media>:<gallery>:<theme>`.
   * Per collection, in item media's shape, in legacy's order: its API listed
   * each kind by the media's legacy id.
   */
  protected async loadThemeMedia(
    collectionIds: string[],
    langCodeMap: Map<string, string>
  ): Promise<Map<string, unknown[]>> {
    const out = new Map<string, unknown[]>()
    if (collectionIds.length === 0) return out
    const rows = await this.db.query<{
      collection_id: string
      language_id: string | null
      type: string
      title: string | null
      description: string | null
      url: string
      backward_compatibility: string | null
    }>(
      `SELECT collection_id, language_id, type, title, description, url, backward_compatibility
       FROM collection_media
       WHERE collection_id IN (${this.placeholders(collectionIds.length)})
         AND backward_compatibility LIKE 'mwnf3\\_thematic\\_gallery:theme\\_%'
       ORDER BY collection_id, type, backward_compatibility`,
      collectionIds
    )
    const legacyId = (key: string | null): number => Number((key ?? '').split(':')[2] ?? 0)
    rows.sort(
      (a, b) =>
        a.collection_id.localeCompare(b.collection_id) ||
        a.type.localeCompare(b.type) ||
        legacyId(a.backward_compatibility) - legacyId(b.backward_compatibility)
    )
    for (const row of rows) {
      const entry = {
        type: row.type,
        title: row.title,
        description: row.description,
        url: row.url,
        language: row.language_id ? (langCodeMap.get(row.language_id) ?? null) : null,
      }
      const bucket = out.get(row.collection_id)
      if (bucket) bucket.push(entry)
      else out.set(row.collection_id, [entry])
    }
    return out
  }
}
