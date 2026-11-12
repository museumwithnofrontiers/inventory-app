/**
 * Tracker Interface - Unified tracking abstraction
 *
 * This interface abstracts the tracking mechanism used by both
 * API-based (BackwardCompatibilityTracker) and SQL-based (Map<string, string>) importers.
 *
 * Following the Interface Segregation Principle, this provides only the
 * methods needed by importers.
 */

import type { EntityType, ImportedEntity } from './types.js';

/**
 * Interface for tracking imported entities by backward_compatibility reference
 */
export interface ITracker {
  /**
   * Register a newly imported entity
   */
  register(entity: ImportedEntity): void;

  /**
   * Check if entity was already imported (requires entityType to avoid collisions)
   */
  exists(backwardCompatibility: string, entityType?: EntityType): boolean;

  /**
   * Get UUID of previously imported entity (requires entityType to avoid collisions)
   */
  getUuid(backwardCompatibility: string, entityType?: EntityType): string | null;

  /**
   * Set a backward_compatibility to UUID mapping directly
   * Used for simple tracking scenarios
   */
  set(backwardCompatibility: string, uuid: string, entityType: EntityType): void;

  /**
   * Get all entities of a specific type
   */
  getByType(entityType: EntityType): ImportedEntity[];

  /**
   * Get import statistics
   */
  getStats(): Record<EntityType, number>;

  /**
   * Get all tracked entities
   */
  getAll(): ImportedEntity[];

  /**
   * Clear all tracked entities
   */
  clear(): void;

  /**
   * Set metadata value
   */
  setMetadata(key: string, value: string): void;

  /**
   * Get metadata value
   */
  getMetadata(key: string): string | null;
}

/**
 * Unified Tracker Implementation
 *
 * Provides a consistent tracking interface that works with both
 * API and SQL import strategies.
 */
export class UnifiedTracker implements ITracker {
  private entities = new Map<string, ImportedEntity>();
  private metadata = new Map<string, string>();

  /**
   * Generate composite key for entity lookup
   */
  private getKey(backwardCompatibility: string, entityType?: EntityType): string {
    return entityType ? `${entityType}:${backwardCompatibility}` : backwardCompatibility;
  }

  register(entity: ImportedEntity): void {
    const normalizedBackwardCompat = entity.backwardCompatibility.toLowerCase();
    const key = this.getKey(normalizedBackwardCompat, entity.entityType);
    this.entities.set(key, { ...entity, backwardCompatibility: normalizedBackwardCompat });
  }

  exists(backwardCompatibility: string, entityType: EntityType): boolean {
    const normalizedBackwardCompat = backwardCompatibility.toLowerCase();
    const key = this.getKey(normalizedBackwardCompat, entityType);
    return this.entities.has(key);
  }

  getUuid(backwardCompatibility: string, entityType: EntityType): string | null {
    const normalizedBackwardCompat = backwardCompatibility.toLowerCase();
    const key = this.getKey(normalizedBackwardCompat, entityType);
    return this.entities.get(key)?.uuid ?? null;
  }

  set(backwardCompatibility: string, uuid: string, entityType: EntityType): void {
    const normalizedBackwardCompat = backwardCompatibility.toLowerCase();
    const key = this.getKey(normalizedBackwardCompat, entityType);
    if (!this.entities.has(key)) {
      this.entities.set(key, {
        uuid,
        backwardCompatibility: normalizedBackwardCompat,
        entityType,
        createdAt: new Date(),
      });
    } else {
      const entity = this.entities.get(key)!;
      entity.uuid = uuid;
    }
  }

  getByType(entityType: EntityType): ImportedEntity[] {
    return Array.from(this.entities.values()).filter((e) => e.entityType === entityType);
  }

  getStats(): Record<EntityType, number> {
    const stats: Record<EntityType, number> = {
      language: 0,
      language_translation: 0,
      country: 0,
      country_translation: 0,
      context: 0,
      collection: 0,
      collection_translation: 0,
      project: 0,
      partner: 0,
      partner_translation: 0,
      item: 0,
      item_translation: 0,
      image: 0,
      tag: 0,
      author: 0,
      author_translation: 0,
      artist: 0,
      dynasty: 0,
      dynasty_translation: 0,
      timeline: 0,
      timeline_event: 0,
      timeline_event_translation: 0,
      glossary: 0,
      glossary_translation: 0,
      glossary_spelling: 0,
      item_item_link: 0,
      item_item_link_translation: 0,
      item_media: 0,
      collection_media: 0,
      item_document: 0,
      contributor: 0,
      contributor_translation: 0,
      publication: 0,
      publication_translation: 0,
      publication_edition: 0,
    };

    for (const entity of this.entities.values()) {
      if (entity.entityType in stats) {
        stats[entity.entityType]++;
      }
    }

    return stats;
  }

  getAll(): ImportedEntity[] {
    return Array.from(this.entities.values());
  }

  clear(): void {
    this.entities.clear();
    this.metadata.clear();
  }

  setMetadata(key: string, value: string): void {
    this.metadata.set(key, value);
  }

  getMetadata(key: string): string | null {
    return this.metadata.get(key) ?? null;
  }

  /**
   * Get the number of tracked entities
   */
  get size(): number {
    return this.entities.size;
  }

  /**
   * Get total count of entities in tracker (for debugging)
   */
  getEntitiesCount(): number {
    return this.entities.size;
  }

  /**
   * Get all keys in tracker (for debugging)
   */
  getAllKeys(): string[] {
    return Array.from(this.entities.keys());
  }
}
