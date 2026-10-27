/**
 * The identity of an mwnf3 item picture: the picture child item the picture
 * importers create for each row group of `objects_pictures` /
 * `monuments_pictures`. One function per table, shared by the importer that
 * creates the picture and by every importer that links to it, so a link
 * finds the picture by construction.
 */
import { formatBackwardCompatibility } from './backward-compatibility.js';

export interface LegacyPictureKey {
  project_id: string;
  country: string;
  number: number;
  image_number: number;
  type: string;
}

// `type` ('' for the default photo, 'plan' for site plans, etc.) is only
// appended when non-empty, so the identity of default-type pictures is
// unchanged (existing resolvers like thg-theme-item-resolver.ts and
// already-imported rows keep matching). Without this, a typed picture
// (e.g. type='plan') sharing the same image_number as the default photo
// would collide with it and be silently skipped as a duplicate — see
// Epic 10 in the islamicart parity backlog.
function pictureBackwardCompatibility(
  table: string,
  key: LegacyPictureKey,
  ownerId: string
): string {
  const pkValues: (string | number)[] = [
    key.project_id,
    key.country,
    ownerId,
    key.number,
    key.image_number,
  ];
  if (key.type && key.type.trim() !== '') {
    pkValues.push(key.type);
  }
  return formatBackwardCompatibility({ schema: 'mwnf3', table, pkValues });
}

export function objectPictureBackwardCompatibility(
  key: LegacyPictureKey & { museum_id: string }
): string {
  return pictureBackwardCompatibility('objects_pictures', key, key.museum_id);
}

export function monumentPictureBackwardCompatibility(
  key: LegacyPictureKey & { institution_id: string }
): string {
  return pictureBackwardCompatibility('monuments_pictures', key, key.institution_id);
}
