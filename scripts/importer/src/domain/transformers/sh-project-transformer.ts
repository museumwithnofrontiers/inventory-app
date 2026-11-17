/**
 * SH Project Transformer
 *
 * Transforms Sharing History project data to the new format.
 * Creates Context, Collection, and Project entities (same pattern as mwnf3 projects).
 */

import type { ShLegacyProject, ShLegacyProjectName } from '../types/index.js';
import type {
  ContextData,
  ContextTranslationData,
  CollectionData,
  CollectionTranslationData,
  ProjectData,
  ProjectTranslationData,
} from '../../core/types.js';
import { mapLanguageCode } from '../../utils/code-mappings.js';
import { convertHtmlToMarkdown, sanitizeDateValue } from '../../utils/html-to-markdown.js';
import { lookupProjectUrls } from '../../utils/project-urls.js';
import { SHARING_HISTORY_COPYRIGHT } from '../../utils/image-copyright.js';

const SH_SCHEMA = 'mwnf3_sharing_history';
const SH_PROJECTS_TABLE = 'sh_projects';

/**
 * Format backward compatibility string for SH entities
 * All string values are normalized to lowercase for consistent key matching
 */
export function formatShBackwardCompatibility(
  table: string,
  ...pkValues: (string | number)[]
): string {
  const normalizedValues = pkValues.map((v) => (typeof v === 'string' ? v.toLowerCase() : v));
  return `${SH_SCHEMA}:${table}:${normalizedValues.join(':')}`;
}

/**
 * Transformed SH project bundle (context + collection + project)
 */
export interface TransformedShProjectBundle {
  context: {
    data: ContextData;
    backwardCompatibility: string;
  };
  collection: {
    data: Omit<CollectionData, 'context_id'>;
    backwardCompatibility: string;
  };
  project: {
    data: Omit<ProjectData, 'context_id'>;
    backwardCompatibility: string;
  };
}

/**
 * Transformed SH project translation bundle
 */
export interface TransformedShProjectTranslationBundle {
  contextTranslation: Omit<ContextTranslationData, 'context_id' | 'backward_compatibility'>;
  collectionTranslation: Omit<
    CollectionTranslationData,
    'collection_id' | 'context_id' | 'backward_compatibility'
  >;
  projectTranslation: Omit<
    ProjectTranslationData,
    'project_id' | 'context_id' | 'backward_compatibility'
  >;
  languageId: string;
}

/**
 * Transform a SH project to context + collection + project bundle
 */
export function transformShProject(
  legacy: ShLegacyProject,
  defaultLanguageId: string,
  projectTitle: string
): TransformedShProjectBundle {
  const backwardCompat = formatShBackwardCompatibility(SH_PROJECTS_TABLE, legacy.project_id);

  if (!legacy.project_id) {
    throw new Error('SH Project missing required project_id field');
  }
  if (!projectTitle) {
    throw new Error(`SH Project ${legacy.project_id} missing title for internal_name`);
  }

  const internalName = convertHtmlToMarkdown(projectTitle);

  // Context
  const contextData: ContextData = {
    internal_name: internalName,
    backward_compatibility: backwardCompat,
    is_default: false,
  };

  // Collection
  const collectionData: Omit<CollectionData, 'context_id'> = {
    internal_name: internalName,
    backward_compatibility: backwardCompat,
    parent_id: null,
    language_id: defaultLanguageId,
  };

  // Project - looked up before formatShBackwardCompatibility's lower-casing, so
  // legacy.project_id is still the raw, uppercase key (e.g. 'AWE') here.
  const projectUrls = lookupProjectUrls(legacy.project_id);
  const projectData: Omit<ProjectData, 'context_id'> = {
    internal_name: internalName,
    backward_compatibility: backwardCompat,
    language_id: defaultLanguageId,
    launch_date: sanitizeDateValue(legacy.addeddate),
    is_launched: legacy.show === 'Y',
    ...projectUrls,
    copyright: SHARING_HISTORY_COPYRIGHT,
  };

  return {
    context: { data: contextData, backwardCompatibility: backwardCompat },
    collection: { data: collectionData, backwardCompatibility: backwardCompat },
    project: { data: projectData, backwardCompatibility: backwardCompat },
  };
}

/**
 * Transform a SH project name to translation bundle
 * Note: SH projects often lack description - field is nullable
 */
export function transformShProjectTranslation(
  legacy: ShLegacyProjectName
): TransformedShProjectTranslationBundle {
  const languageId = mapLanguageCode(legacy.lang);
  const title = convertHtmlToMarkdown(legacy.title || '');
  const subTitle = legacy.sub_title ? convertHtmlToMarkdown(legacy.sub_title) : null;
  // SH projects often don't have introduction/description - this is acceptable
  const introduction = legacy.introduction ? convertHtmlToMarkdown(legacy.introduction) : null;

  // Combine title and subtitle for name
  const fullName = subTitle ? `${title} - ${subTitle}` : title;

  return {
    contextTranslation: {
      language_id: languageId,
      name: fullName,
    },
    collectionTranslation: {
      language_id: languageId,
      title: fullName,
      // Description can be null - SH projects often don't have descriptions
      description: introduction,
    },
    projectTranslation: {
      language_id: languageId,
      name: fullName,
      description: introduction,
    },
    languageId,
  };
}
