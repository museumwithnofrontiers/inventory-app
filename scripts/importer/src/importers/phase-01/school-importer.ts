/**
 * School Importer
 *
 * Imports schools from mwnf3.schools + schoolnames + schools_pictures.
 * Creates Partner entities (type: school) with translations, images, and logos.
 * Follows the same pattern as PartnerImporter for museums/institutions.
 *
 * Phase placement: Phase 01, alongside existing PartnerImporter.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult, PartnerImageData } from '../../core/types.js';
import {
  transformSchool,
  transformSchoolTranslation,
  groupSchoolsByKey,
} from '../../domain/transformers/index.js';
import type {
  LegacySchool,
  LegacySchoolName,
  LegacySchoolPicture,
} from '../../domain/types/index.js';
import { formatBackwardCompatibility } from '../../utils/backward-compatibility.js';
import { toImageCopyright } from '../../utils/image-copyright.js';
import path from 'path';

export class SchoolImporter extends BaseImporter {
  private defaultContextId!: string;

  getName(): string {
    return 'SchoolImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      // Get default context ID for partner translations
      const defaultContextId = await this.getDefaultContextIdAsync();
      if (!defaultContextId) {
        throw new Error('Default context not found. Run DefaultContextImporter first.');
      }
      this.defaultContextId = defaultContextId;

      // Import schools as partners
      this.logInfo('Importing schools...');
      const schoolResult = await this.importSchools();
      result.imported += schoolResult.imported;
      result.skipped += schoolResult.skipped;
      result.errors.push(...schoolResult.errors);

      // Import school pictures
      this.logInfo('Importing school pictures...');
      const pictureResult = await this.importSchoolPictures();
      result.imported += pictureResult.imported;
      result.skipped += pictureResult.skipped;
      result.errors.push(...pictureResult.errors);

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to import schools: ${message}`);
      result.success = false;
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private async importSchools(): Promise<ImportResult> {
    const result = this.createResult();

    const schools = await this.context.legacyDb.query<LegacySchool>(
      'SELECT * FROM mwnf3.schools ORDER BY school_id, country'
    );

    const schoolNames = await this.context.legacyDb.query<LegacySchoolName>(
      'SELECT * FROM mwnf3.schoolnames ORDER BY school_id, country, lang'
    );

    const grouped = groupSchoolsByKey(schools, schoolNames);
    this.logInfo(`Found ${grouped.length} unique schools`);

    let logosCount = 0;

    for (const group of grouped) {
      try {
        const transformed = transformSchool(group.school);

        // Check if already exists
        if (await this.entityExistsAsync(transformed.backwardCompatibility, 'partner')) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        // Resolve project_id
        if (group.school.project_id) {
          const projectBC = formatBackwardCompatibility({
            schema: 'mwnf3',
            table: 'projects',
            pkValues: [group.school.project_id],
          });
          const projectId = await this.getEntityUuidAsync(projectBC, 'project');
          if (projectId) {
            transformed.data.project_id = projectId;
          } else {
            this.logWarning(
              `School ${group.key}: project ${group.school.project_id} not found, skipping project assignment`
            );
          }
        }

        // Count logos for reporting
        if (transformed.logo) {
          logosCount++;
        }

        // Collect sample
        this.collectSample('school', group.school as unknown as Record<string, unknown>, 'success');

        if (this.isDryRun || this.isSampleOnlyMode) {
          this.logInfo(
            `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would import school: ${group.key}` +
              (transformed.logo ? ' (has logo)' : '')
          );
          this.registerEntity(
            'sample-school-' + group.key,
            transformed.backwardCompatibility,
            'partner'
          );
          result.imported++;
          this.showProgress();
          continue;
        }

        // Create partner (type: school)
        const partnerId = await this.context.strategy.writePartner(transformed.data);
        this.registerEntity(partnerId, transformed.backwardCompatibility, 'partner');

        // Create partner logo (size: 1 placeholder for ImageSyncTool)
        if (transformed.logo) {
          try {
            const originalName = path.basename(transformed.logo);
            const mimeType = this.getMimeType(transformed.logo);
            await this.context.strategy.writePartnerLogo({
              partner_id: partnerId,
              path: transformed.logo,
              original_name: originalName,
              mime_type: mimeType,
              size: 1, // Placeholder for ImageSyncTool
              logo_type: 'primary',
              alt_text: null,
              display_order: 1,
            });
          } catch (logoError) {
            const logoMsg = logoError instanceof Error ? logoError.message : String(logoError);
            this.logWarning(`School ${group.key}: failed to import logo: ${logoMsg}`);
          }
        }

        // Create partner translations
        for (const translation of group.translations) {
          try {
            const transformed_translation = transformSchoolTranslation(group.school, translation);

            // Resolve language
            const languageId = await this.getLanguageIdByLegacyCodeAsync(translation.lang);
            if (!languageId) {
              this.logWarning(
                `School ${group.key}: unknown language '${translation.lang}', skipping translation`
              );
              continue;
            }

            await this.context.strategy.writePartnerTranslation({
              ...transformed_translation.data,
              partner_id: partnerId,
              context_id: this.defaultContextId,
              language_id: languageId,
            });
          } catch (translationError) {
            const msg =
              translationError instanceof Error
                ? translationError.message
                : String(translationError);
            this.logWarning(
              `School ${group.key}: failed to import translation (${translation.lang}): ${msg}`
            );
          }
        }

        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const backwardCompat = formatBackwardCompatibility({
          schema: 'mwnf3',
          table: 'schools',
          pkValues: [group.school.school_id, group.school.country],
        });
        result.errors.push(`${backwardCompat}: ${message}`);
        this.logError(`School ${group.key}`, message);
        this.showError();
      }
    }

    if (logosCount > 0) {
      this.logInfo(`Imported ${logosCount} school logos (size: 1 placeholders)`);
    }

    return result;
  }

  private async importSchoolPictures(): Promise<ImportResult> {
    const result = this.createResult();

    const pictures = await this.context.legacyDb.query<LegacySchoolPicture>(
      'SELECT * FROM mwnf3.schools_pictures ORDER BY school_id, country, image_number'
    );

    if (pictures.length === 0) {
      this.logInfo('No school pictures found');
      return result;
    }

    this.logInfo(`Found ${pictures.length} school pictures`);

    for (const picture of pictures) {
      try {
        const backwardCompat = formatBackwardCompatibility({
          schema: 'mwnf3',
          table: 'schools_pictures',
          pkValues: [picture.school_id, picture.country, String(picture.image_number)],
        });

        // Find parent Partner
        const partnerBC = formatBackwardCompatibility({
          schema: 'mwnf3',
          table: 'schools',
          pkValues: [picture.school_id, picture.country],
        });
        const partnerId = await this.getEntityUuidAsync(partnerBC, 'partner');
        if (!partnerId) {
          throw new Error(`Partner not found: ${partnerBC}`);
        }

        // Check if already imported. partner_images has no
        // backward_compatibility column — identity is (owner, legacy path).
        const imageKey = picture.path.toLowerCase();
        if (await this.imageExistsAsync('partner_images', partnerId, picture.path)) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        if (this.isDryRun || this.isSampleOnlyMode) {
          this.logInfo(
            `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would import school picture: ${backwardCompat}`
          );
          this.registerEntity(`sample-image-${backwardCompat}`, imageKey, 'image');
          result.imported++;
          this.showProgress();
          continue;
        }

        // Build alt_text from the caption; without one it stays null, since a
        // legacy file path is no alternative text
        let altText = picture.caption?.trim() || null;
        if (altText && altText.length > 500) {
          altText = altText.substring(0, 497) + '...';
        }

        const mimeType = this.getMimeType(picture.path);
        const originalName = path.basename(picture.path);

        // Build extra for photographer/copyright
        const extra: Record<string, string> = {};
        if (picture.photographer) extra.photographer = picture.photographer;
        if (picture.copyright) extra.copyright = picture.copyright;

        const imageData: PartnerImageData = {
          id: undefined,
          partner_id: partnerId,
          path: picture.path,
          original_name: originalName,
          mime_type: mimeType,
          size: 1, // Placeholder for ImageSyncTool
          alt_text: altText,
          copyright: toImageCopyright(picture.copyright),
          display_order: picture.image_number,
        };

        await this.context.strategy.writePartnerImage(imageData);

        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const backwardCompat = formatBackwardCompatibility({
          schema: 'mwnf3',
          table: 'schools_pictures',
          pkValues: [picture.school_id, picture.country, String(picture.image_number)],
        });
        result.errors.push(`${backwardCompat}: ${message}`);
        this.logError(`School picture ${backwardCompat}`, message);
        this.showError();
      }
    }

    return result;
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.tif': 'image/tiff',
      '.tiff': 'image/tiff',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}
