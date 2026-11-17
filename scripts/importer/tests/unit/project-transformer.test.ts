/**
 * Tests for the project transformer's site/related-database/artistic-introduction
 * URL wiring (epic #1727) - transformProject() should attach the looked-up
 * ProjectUrls fields for known legacy project keys and null them out for
 * unmapped ones.
 */

import { describe, it, expect } from 'vitest';
import { transformProject } from '../../src/domain/transformers/project-transformer.js';
import type { LegacyProject } from '../../src/domain/types/index.js';

function makeLegacyProject(overrides: Partial<LegacyProject> = {}): LegacyProject {
  return {
    project_id: 'ISL',
    name: 'Islamic Art',
    active: 1,
    ...overrides,
  };
}

describe('transformProject - project URL fields', () => {
  it('attaches the Islamic Art URLs for ISL', () => {
    const bundle = transformProject(makeLegacyProject({ project_id: 'ISL' }), 'eng', 'Islamic Art');

    expect(bundle.project.data.site_url).toBe('https://islamicart.museumwnf.org');
    expect(bundle.project.data.related_database_url).toBe(
      'https://islamicart.museumwnf.org/database.php'
    );
    expect(bundle.project.data.artistic_introduction_url).toBe(
      'https://islamicart.museumwnf.org/gai/ISL/'
    );
  });

  it('attaches the Baroque Art URLs for BAR, with no artistic introduction', () => {
    const bundle = transformProject(
      makeLegacyProject({ project_id: 'BAR' }),
      'eng',
      'Baroque Art'
    );

    expect(bundle.project.data.site_url).toBe('https://baroqueart.museumwnf.org');
    expect(bundle.project.data.related_database_url).toBe(
      'https://baroqueart.museumwnf.org/database.php'
    );
    expect(bundle.project.data.artistic_introduction_url).toBeNull();
  });

  it('attaches the Sharing History URLs for AWE, with no artistic introduction', () => {
    const bundle = transformProject(
      makeLegacyProject({ project_id: 'AWE' }),
      'eng',
      'A World of Encounters'
    );

    expect(bundle.project.data.site_url).toBe('https://sharinghistory.museumwnf.org');
    expect(bundle.project.data.related_database_url).toBe(
      'https://sharinghistory.museumwnf.org/database.php'
    );
    expect(bundle.project.data.artistic_introduction_url).toBeNull();
  });

  it('leaves all three URL fields null for an unmapped legacy project key (e.g. DCA)', () => {
    const bundle = transformProject(
      makeLegacyProject({ project_id: 'DCA' }),
      'eng',
      'Discover Islamic Art'
    );

    expect(bundle.project.data.site_url).toBeNull();
    expect(bundle.project.data.related_database_url).toBeNull();
    expect(bundle.project.data.artistic_introduction_url).toBeNull();
  });

  it('leaves all three URL fields null for a legacy key with no map entry at all', () => {
    const bundle = transformProject(
      makeLegacyProject({ project_id: 'EXWIT' }),
      'eng',
      'Some One-Off Exhibition'
    );

    expect(bundle.project.data.site_url).toBeNull();
    expect(bundle.project.data.related_database_url).toBeNull();
    expect(bundle.project.data.artistic_introduction_url).toBeNull();
  });
});

describe('transformProject - copyright', () => {
  it("gives ISL legacy's Discover Islamic Art credit line", () => {
    const bundle = transformProject(makeLegacyProject({ project_id: 'ISL' }), 'eng', 'Islamic Art');

    expect(bundle.project.data.copyright).toBe('© Discover Islamic Art (MWNF)');
  });

  it('leaves BAR to the global fallback', () => {
    const bundle = transformProject(makeLegacyProject({ project_id: 'BAR' }), 'eng', 'Baroque Art');

    expect(bundle.project.data.copyright).toBeNull();
  });
});
