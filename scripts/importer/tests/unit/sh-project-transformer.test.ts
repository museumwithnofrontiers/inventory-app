/**
 * Tests for the Sharing History project transformer's site/related-database/
 * artistic-introduction URL wiring (epic #1727). transformShProject() must
 * look up ProjectUrls using the RAW, UPPERCASE legacy project_id ('AWE'),
 * i.e. before formatShBackwardCompatibility's own lower-casing is applied.
 */

import { describe, it, expect } from 'vitest';
import { transformShProject } from '../../src/domain/transformers/sh-project-transformer.js';
import type { ShLegacyProject } from '../../src/domain/types/index.js';

function makeShLegacyProject(overrides: Partial<ShLegacyProject> = {}): ShLegacyProject {
  return {
    project_id: 'AWE',
    name: 'A World of Encounters',
    show: 'Y',
    ...overrides,
  };
}

describe('transformShProject - project URL fields', () => {
  it('attaches the Sharing History URLs for AWE (uppercase legacy key)', () => {
    const bundle = transformShProject(
      makeShLegacyProject({ project_id: 'AWE' }),
      'eng',
      'A World of Encounters'
    );

    expect(bundle.project.data.site_url).toBe('https://sharinghistory.museumwnf.org');
    expect(bundle.project.data.related_database_url).toBe(
      'https://sharinghistory.museumwnf.org/database.php'
    );
    expect(bundle.project.data.artistic_introduction_url).toBeNull();
  });

  it('does not match on the lower-cased backward_compatibility form ("awe")', () => {
    // The transformer must look up URLs from legacy.project_id ('AWE') before
    // formatShBackwardCompatibility lower-cases it for the backward_compatibility
    // string - the URL map itself is case-sensitive and only has an 'AWE' entry.
    const bundle = transformShProject(
      makeShLegacyProject({ project_id: 'AWE' }),
      'eng',
      'A World of Encounters'
    );

    expect(bundle.project.backwardCompatibility).toContain('awe');
    expect(bundle.project.data.site_url).not.toBeNull();
  });

  it('leaves all three URL fields null for an unmapped SH project key', () => {
    const bundle = transformShProject(
      makeShLegacyProject({ project_id: 'SOME_SH_ONE_OFF' }),
      'eng',
      'Some Portal Project'
    );

    expect(bundle.project.data.site_url).toBeNull();
    expect(bundle.project.data.related_database_url).toBeNull();
    expect(bundle.project.data.artistic_introduction_url).toBeNull();
  });
});

describe('transformShProject - copyright', () => {
  it("gives every Sharing History project legacy's credit line", () => {
    const bundle = transformShProject(makeShLegacyProject(), 'eng', 'A World of Encounters');

    expect(bundle.project.data.copyright).toBe('© MWNF | Sharing History');
  });
});
