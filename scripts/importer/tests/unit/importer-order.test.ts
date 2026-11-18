import { describe, expect, it } from 'vitest';

import { orderConfigsByDependencies } from '../../src/utils/importer-order.js';

describe('orderConfigsByDependencies', () => {
  it('reorders importers so dependencies run first', () => {
    const ordered = orderConfigsByDependencies([
      { key: 'explore-monument-crossref', dependencies: ['travels-monument', 'explore-monument'] },
      { key: 'explore-monument', dependencies: [] },
      { key: 'travels-monument', dependencies: ['travels-location'] },
      { key: 'travels-location', dependencies: [] },
    ]);

    expect(ordered.map((config) => config.key)).toEqual([
      'explore-monument',
      'travels-location',
      'travels-monument',
      'explore-monument-crossref',
    ]);
  });

  it('ignores dependencies outside the selected config set', () => {
    const ordered = orderConfigsByDependencies([
      { key: 'explore-monument-crossref', dependencies: ['travels-monument', 'explore-monument'] },
      { key: 'explore-monument', dependencies: [] },
    ]);

    expect(ordered.map((config) => config.key)).toEqual([
      'explore-monument',
      'explore-monument-crossref',
    ]);
  });

  it('throws on circular dependencies inside the selected set', () => {
    expect(() =>
      orderConfigsByDependencies([
        { key: 'a', dependencies: ['b'] },
        { key: 'b', dependencies: ['a'] },
      ])
    ).toThrow('Circular importer dependencies detected');
  });
  it('runs a runsLast step after every other one, whatever its place in the list', () => {
    const ordered = orderConfigsByDependencies([
      { key: 'default-context', dependencies: [] },
      { key: 'collection-credits', runsLast: true },
      { key: 'travels-trail', dependencies: ['default-context'] },
      { key: 'travels-trail-translation', dependencies: ['travels-trail'] },
      { key: 'project-cleanup', dependencies: [] },
    ]);

    expect(ordered.map((config) => config.key)).toEqual([
      'default-context',
      'project-cleanup',
      'travels-trail',
      'travels-trail-translation',
      'collection-credits',
    ]);
  });

  it('refuses a step that depends on one that runs last', () => {
    expect(() =>
      orderConfigsByDependencies([
        { key: 'collection-credits', runsLast: true },
        { key: 'exporter-prep', dependencies: ['collection-credits'] },
      ])
    ).toThrow('which runs last');
  });
});
