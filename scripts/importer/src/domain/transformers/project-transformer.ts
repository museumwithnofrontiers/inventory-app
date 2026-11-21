/**
 * Project Transformer
 *
 * Transforms legacy project data to the new format.
 * Creates Context, Collection, and Project entities.
 * This is pure business logic with no dependencies on write strategy.
 */

import type { LegacyProject, LegacyProjectName } from '../types/index.js';
import type {
  ContextData,
  ContextTranslationData,
  CollectionData,
  CollectionTranslationData,
  ProjectData,
  ProjectTranslationData,
} from '../../core/types.js';
import { mapLanguageCode } from '../../utils/code-mappings.js';
import { formatBackwardCompatibility } from '../../utils/backward-compatibility.js';
import { convertHtmlToMarkdown, sanitizeDateValue } from '../../utils/html-to-markdown.js';
import { lookupProjectUrls } from '../../utils/project-urls.js';
import { mwnf3ProjectCopyright } from '../../utils/image-copyright.js';

/**
 * Transformed project bundle (context + collection + project)
 */
export interface TransformedProjectBundle {
  context: {
    data: ContextData;
    backwardCompatibility: string;
  };
  collection: {
    data: Omit<CollectionData, 'context_id'>; // context_id added after context creation
    backwardCompatibility: string;
  };
  project: {
    data: Omit<ProjectData, 'context_id'>; // context_id added after context creation
    backwardCompatibility: string;
  };
}

/**
 * Transformed project translation bundle
 */
export interface TransformedProjectTranslationBundle {
  contextTranslation: Omit<ContextTranslationData, 'context_id'>;
  collectionTranslation: Omit<CollectionTranslationData, 'collection_id' | 'context_id'>;
  projectTranslation: Omit<ProjectTranslationData, 'project_id' | 'context_id'>;
  languageId: string;
}

/**
 * Transform a legacy project to context + collection + project bundle
 * @param projectName The project name from the default language translation to use as internal_name
 */
export function transformProject(
  legacy: LegacyProject,
  defaultLanguageId: string,
  projectName: string
): TransformedProjectBundle {
  const baseBackwardCompat = formatBackwardCompatibility({
    schema: 'mwnf3',
    table: 'projects',
    pkValues: [legacy.project_id],
  });

  // Context - internal_name uses project name (unaltered) from default language
  if (!legacy.project_id) {
    throw new Error('Project missing required project_id field');
  }
  if (!projectName) {
    throw new Error(`Project ${legacy.project_id} missing project name for internal_name`);
  }
  const contextBackwardCompat = baseBackwardCompat;
  const contextData: ContextData = {
    internal_name: projectName,
    backward_compatibility: contextBackwardCompat,
    is_default: false,
  };

  // Collection - internal_name uses project name (unaltered) from default language
  // Use same backward_compatibility as context - tracker composite key (entityType:backwardCompat) handles uniqueness
  const collectionBackwardCompat = baseBackwardCompat;
  const collectionData: Omit<CollectionData, 'context_id'> = {
    internal_name: projectName,
    backward_compatibility: collectionBackwardCompat,
    parent_id: null,
    language_id: defaultLanguageId,
  };

  // Project - internal_name uses project name (unaltered) from default language
  const projectBackwardCompat = baseBackwardCompat;
  const projectUrls = lookupProjectUrls(legacy.project_id);
  const projectData: Omit<ProjectData, 'context_id'> = {
    internal_name: projectName,
    backward_compatibility: projectBackwardCompat,
    language_id: defaultLanguageId,
    launch_date: sanitizeDateValue(legacy.launchdate),
    ...projectUrls,
    copyright: mwnf3ProjectCopyright(legacy.project_id),
  };

  return {
    context: { data: contextData, backwardCompatibility: contextBackwardCompat },
    collection: { data: collectionData, backwardCompatibility: collectionBackwardCompat },
    project: { data: projectData, backwardCompatibility: projectBackwardCompat },
  };
}

/**
 * Transform a legacy project name to translations bundle
 */
export function transformProjectTranslation(
  legacy: LegacyProjectName
): TransformedProjectTranslationBundle {
  const languageId = mapLanguageCode(legacy.lang);

  // Translation name is required - no fallback. Description is optional: the
  // legacy `projectnames` table never had a description column, and the
  // synthetic description generated from the thematic gallery data doesn't
  // cover every project/language combination. collection_translations.description
  // is nullable specifically to accommodate this gap.
  if (!legacy.name) {
    throw new Error(
      `Project translation ${legacy.project_id}:${legacy.lang} missing required name field`
    );
  }
  const name = convertHtmlToMarkdown(legacy.name);
  const description = legacy.description ? convertHtmlToMarkdown(legacy.description) : null;

  // Collection translation uses same backward_compatibility as parent collection
  const backwardCompatibility = formatBackwardCompatibility({
    schema: 'mwnf3',
    table: 'projects',
    pkValues: [legacy.project_id],
  });

  return {
    contextTranslation: {
      language_id: languageId,
      name: name,
      description: description,
    },
    collectionTranslation: {
      language_id: languageId,
      backward_compatibility: backwardCompatibility,
      title: name,
      description: description,
    },
    projectTranslation: {
      language_id: languageId,
      name: name,
      description: description,
    },
    languageId,
  };
}
