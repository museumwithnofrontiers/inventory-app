/**
 * Image Synchronization Tool
 *
 * Synchronizes legacy images to new storage by:
 * 1. Finding records with size=1 (legacy placeholder) in item_images,
 *    partner_images, partner_logos, collection_images, contributor_images,
 *    timeline_event_images
 * 2. Copying or symlinking the actual image file from legacy storage
 * 3. Updating the database record with correct path, size, and metadata
 *
 * This is a standalone tool that only connects to the new database.
 */

import type { Connection } from 'mysql2/promise';
import type { ILogger } from '../core/base-importer.js';
import {
  getFileExtension,
  getLegacyImagePath,
  getNewImagePath,
  copyFile,
  symlinkFile,
  getFileSize,
  fileExists,
  ensureDirectory,
  clearDirectory,
} from '../utils/image-sync.js';

interface ImageRecord {
  id: string;
  path: string;
  size: number;
  original_name: string | null;
  alt_text: string | null;
  mime_type: string;
}

export interface ImageSyncOptions {
  useSymlink: boolean;
  legacyImagesRoot: string;
  newImagesRoot: string;
  clearDestination?: boolean;
  dryRun?: boolean;
}

export interface ImageSyncResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

export class ImageSyncTool {
  private db: Connection;
  private options: ImageSyncOptions;
  private logger: ILogger;

  constructor(db: Connection, options: ImageSyncOptions, logger: ILogger) {
    this.db = db;
    this.options = options;
    this.logger = logger;
  }

  async run(): Promise<ImageSyncResult> {
    const result: ImageSyncResult = {
      success: true,
      imported: 0,
      skipped: 0,
      errors: [],
    };

    try {
      this.logger.info('Starting image synchronization...');
      this.logger.info(`Mode: ${this.options.useSymlink ? 'SYMLINK' : 'COPY'}`);
      this.logger.info(`Legacy images root: ${this.options.legacyImagesRoot}`);
      this.logger.info(`New images root: ${this.options.newImagesRoot}`);
      this.logger.info(`Clear destination: ${this.options.clearDestination ? 'YES' : 'NO'}`);
      this.logger.info(`Dry-run: ${this.options.dryRun ? 'YES' : 'NO'}`);

      // Ensure new images directory exists
      await ensureDirectory(this.options.newImagesRoot);

      if (this.options.clearDestination) {
        if (this.options.dryRun) {
          this.logger.info(
            `[DRY-RUN] Would clear destination directory: ${this.options.newImagesRoot}`
          );
        } else {
          this.logger.info(`Clearing destination directory: ${this.options.newImagesRoot}`);
          await clearDirectory(this.options.newImagesRoot);
        }
      }

      const tables = [
        'item_images',
        'partner_images',
        'partner_logos',
        'collection_images',
        'contributor_images',
        'timeline_event_images',
      ];

      for (const table of tables) {
        this.logger.info(`\n=== Syncing ${table} ===`);
        const tableResult = await this.syncTable(table);
        result.imported += tableResult.synced;
        result.skipped += tableResult.skipped;
        result.errors.push(...tableResult.errors);
      }

      this.logger.info(
        `Completed image sync: ${result.imported} synced, ${result.skipped} skipped, ${result.errors.length} errors`
      );
      this.logger.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof Error) {
        this.logger.exception('ImageSync', error);
      } else {
        this.logger.error('ImageSync', message);
      }
      result.errors.push(`Image sync failed: ${message}`);
      result.success = false;
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private async syncTable(tableName: string): Promise<{
    synced: number;
    skipped: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let synced = 0;
    let skipped = 0;

    this.logger.info(`Starting image sync table: ${tableName}`);
    const images = await this.queryImages(tableName);
    this.logger.info(`Found ${images.length} ${tableName} records with size=1 to sync`);

    if (images.length === 0) {
      this.logger.warning(
        `No images with size=1 found in ${tableName} — was image-sync already run?`
      );
      this.logger.info(
        `Completed image sync table ${tableName}: ${synced} synced, ${skipped} skipped, ${errors.length} errors`
      );
      return { synced, skipped, errors };
    }

    for (const image of images) {
      try {
        const result = await this.syncImage(image, tableName);
        if (result) {
          synced++;
          this.logger.showProgress();
        } else {
          skipped++;
          this.logger.skip(`${tableName} ${image.id}: skipped (syncImage returned false)`);
          this.logger.showSkipped();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${tableName} ${image.id}: ${message}`);
        this.logger.error(`${tableName} ${image.id}`, message);
        this.logger.showError();
      }
    }

    this.logger.info(
      `Completed image sync table ${tableName}: ${synced} synced, ${skipped} skipped, ${errors.length} errors`
    );
    this.logger.showSummary(synced, skipped, errors.length);
    return { synced, skipped, errors };
  }

  private async queryImages(tableName: string): Promise<ImageRecord[]> {
    const query = `
      SELECT id, path, size, original_name, alt_text, mime_type
      FROM ${tableName}
      WHERE size = 1
      ORDER BY id
    `;

    const [rows] = await this.db.execute(query);
    return rows as ImageRecord[];
  }

  private async syncImage(image: ImageRecord, tableName: string): Promise<boolean> {
    if (this.options.dryRun) {
      this.logger.info(`[DRY-RUN] Would sync ${tableName}.${image.id}: ${image.path}`);
      return true;
    }

    // Get legacy image path
    const legacyPath = getLegacyImagePath(this.options.legacyImagesRoot, image.path);

    // Check if legacy image exists
    if (!(await fileExists(legacyPath))) {
      throw new Error(`Legacy image not found: ${legacyPath}`);
    }

    // Get file extension
    const extension = getFileExtension(image.path);
    if (!extension) {
      throw new Error(`Cannot determine file extension from path: ${image.path}`);
    }

    // Build new path
    const newPath = getNewImagePath(this.options.newImagesRoot, image.id, extension);

    // Copy or symlink the file
    if (this.options.useSymlink) {
      await symlinkFile(legacyPath, newPath);
    } else {
      await copyFile(legacyPath, newPath);
    }

    // Get actual file size
    const actualSize = await getFileSize(newPath);

    // Update database record with just the filename (no leading slash, no directory).
    // Only the file facts change: alt_text and the rest are the importers' data.
    const filename = `${image.id}${extension}`;
    await this.updateImageRecord(tableName, image.id, {
      path: filename,
      size: actualSize,
      original_name: image.path,
    });

    return true;
  }

  private async updateImageRecord(
    tableName: string,
    id: string,
    updates: {
      path: string;
      size: number;
      original_name: string;
    }
  ): Promise<void> {
    const query = `
      UPDATE ${tableName}
      SET path = ?,
          size = ?,
          original_name = ?,
          updated_at = NOW()
      WHERE id = ?
    `;

    await this.db.execute(query, [updates.path, updates.size, updates.original_name, id]);
  }
}
