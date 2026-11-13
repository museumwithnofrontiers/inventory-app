/**
 * Image Synchronization Utilities
 *
 * Utilities for copying or symlinking legacy images to the new storage structure.
 * Handles path normalization, file operations, and metadata extraction.
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Normalize a path by removing leading slashes and backslashes
 * Both "/x/y/z.jpg" and "x/y/z.jpg" should become "x/y/z.jpg"
 */
export function normalizePath(imagePath: string): string {
  return imagePath.replace(/^[/\\]+/, '');
}

/**
 * Get file extension from a path (including the dot)
 * e.g., "/path/to/image.jpg" returns ".jpg"
 */
export function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * Build the full legacy image path
 */
export function getLegacyImagePath(legacyRoot: string, relativePath: string): string {
  const normalized = normalizePath(relativePath);
  return path.join(legacyRoot, normalized);
}

/**
 * Find a legacy file whatever the letter case of its path. Legacy ran on
 * Windows, where `awe/x.pdf` and `AWE/x.pdf` are the same file, so its
 * database never had to agree with the disk on case; the mirror is read on
 * Linux. The exact path wins; otherwise each segment is matched without regard
 * to case. Returns null when no file matches.
 */
export async function resolveLegacyFile(
  legacyRoot: string,
  relativePath: string
): Promise<string | null> {
  const exact = getLegacyImagePath(legacyRoot, relativePath);
  if (await fileExists(exact)) {
    return exact;
  }

  const segments = normalizePath(relativePath)
    .split(/[/\\]+/)
    .filter((segment) => segment !== '');
  if (segments.length === 0) {
    return null;
  }
  let current = legacyRoot;
  for (const segment of segments) {
    const direct = path.join(current, segment);
    if (await fileExists(direct)) {
      current = direct;
      continue;
    }
    let entries: string[];
    try {
      entries = await readDirectoryCached(current);
    } catch {
      return null;
    }
    const wanted = segment.toLowerCase();
    const match = entries.find((entry) => entry.toLowerCase() === wanted);
    if (match === undefined) {
      return null;
    }
    current = path.join(current, match);
  }
  return current;
}

const directoryListings = new Map<string, string[]>();

/** Directory listings, kept for the run: the legacy mirror doesn't change while it is read. */
async function readDirectoryCached(dirPath: string): Promise<string[]> {
  let entries = directoryListings.get(dirPath);
  if (entries === undefined) {
    entries = await fs.readdir(dirPath);
    directoryListings.set(dirPath, entries);
  }
  return entries;
}

/**
 * Build the new storage path using UUID
 */
export function getNewImagePath(storageRoot: string, uuid: string, extension: string): string {
  // Ensure extension starts with a dot
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return path.join(storageRoot, `${uuid}${ext}`);
}

/**
 * Copy a file from source to destination
 */
export async function copyFile(sourcePath: string, destPath: string): Promise<void> {
  await fs.copyFile(sourcePath, destPath);
}

/**
 * Create a symbolic link from source to destination
 * On Windows, requires admin privileges or developer mode
 */
export async function symlinkFile(sourcePath: string, destPath: string): Promise<void> {
  // Resolve to absolute paths
  const absoluteSource = path.resolve(sourcePath);
  const absoluteDest = path.resolve(destPath);

  // Remove existing file/link if it exists
  try {
    await fs.unlink(absoluteDest);
  } catch {
    // File doesn't exist, that's fine
  }

  // Create symlink (use 'file' type for cross-platform compatibility)
  await fs.symlink(absoluteSource, absoluteDest, 'file');
}

/**
 * Get file size in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
  const stats = await fs.stat(filePath);
  return stats.size;
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Ignore if directory already exists
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Clear all contents of a directory while keeping the directory itself.
 */
export async function clearDirectory(dirPath: string): Promise<void> {
  await ensureDirectory(dirPath);
  const entries = await fs.readdir(dirPath);

  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dirPath, entry);
      await fs.rm(entryPath, { recursive: true, force: true });
    })
  );
}
