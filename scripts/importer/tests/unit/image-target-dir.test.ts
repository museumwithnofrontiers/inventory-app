/**
 * `image-sync` writes pristine originals, so its fallback destination must be
 * the app's private originals directory — never the public pictures cache,
 * which `/pub` fills with burned renditions on demand.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  IMAGE_TARGET_ARTISAN_COMMAND,
  resolveImageTargetDir,
} from '../../src/tools/image-target-dir.js';

describe('resolveImageTargetDir', () => {
  it('falls back to the private originals directory reported by Laravel', async () => {
    const runArtisan = vi
      .fn()
      .mockResolvedValue('/var/www/app/storage/app/private/image-originals/images\n');

    const target = await resolveImageTargetDir({ env: {}, runArtisan });

    expect(runArtisan).toHaveBeenCalledWith('php artisan storage:image-path available');
    expect(IMAGE_TARGET_ARTISAN_COMMAND).not.toContain('pictures');
    expect(target).toEqual({
      path: '/var/www/app/storage/app/private/image-originals/images',
      source: 'artisan',
    });
  });

  it('prefers --target-dir over everything else', async () => {
    const runArtisan = vi.fn();

    const target = await resolveImageTargetDir({
      targetDir: ' /staging/images ',
      env: { NEW_IMAGES_ROOT: '/elsewhere' },
      runArtisan,
    });

    expect(target).toEqual({ path: '/staging/images', source: 'option' });
    expect(runArtisan).not.toHaveBeenCalled();
  });

  it('uses NEW_IMAGES_ROOT when no --target-dir is given', async () => {
    const runArtisan = vi.fn();

    const target = await resolveImageTargetDir({
      targetDir: '   ',
      env: { NEW_IMAGES_ROOT: '/data/originals' },
      runArtisan,
    });

    expect(target).toEqual({ path: '/data/originals', source: 'env' });
    expect(runArtisan).not.toHaveBeenCalled();
  });

  it('refuses an empty answer from Laravel instead of syncing into the working directory', async () => {
    await expect(
      resolveImageTargetDir({ env: {}, runArtisan: vi.fn().mockResolvedValue('  \n') })
    ).rejects.toThrow('printed no path');
  });
});
