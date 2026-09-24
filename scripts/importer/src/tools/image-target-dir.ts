/**
 * Where `image-sync` writes the legacy image files it copies or links.
 *
 * Those files are pristine originals, so when neither `--target-dir` nor
 * `NEW_IMAGES_ROOT` says otherwise, Laravel is asked for its private originals
 * directory (`storage:image-path available`: the image-originals disk). Never
 * `pictures`: that directory is only the cache of burned renditions `/pub`
 * fills on demand, and originals written there have nothing to be burned from.
 */

export const IMAGE_TARGET_ARTISAN_COMMAND = 'php artisan storage:image-path available';

export type ImageTargetSource = 'option' | 'env' | 'artisan';

export interface ImageTargetDir {
  path: string;
  source: ImageTargetSource;
}

export async function resolveImageTargetDir(input: {
  targetDir?: string | undefined;
  env: Record<string, string | undefined>;
  runArtisan: (command: string) => Promise<string>;
}): Promise<ImageTargetDir> {
  const fromOption = input.targetDir?.trim();
  if (fromOption) {
    return { path: fromOption, source: 'option' };
  }

  const fromEnv = input.env['NEW_IMAGES_ROOT']?.trim();
  if (fromEnv) {
    return { path: fromEnv, source: 'env' };
  }

  const fromArtisan = (await input.runArtisan(IMAGE_TARGET_ARTISAN_COMMAND)).trim();
  if (!fromArtisan) {
    throw new Error(`\`${IMAGE_TARGET_ARTISAN_COMMAND}\` printed no path`);
  }

  return { path: fromArtisan, source: 'artisan' };
}
