// The sitemap takes an exhibition's legacy address from config/legacy.php (#2379): the Hijaz
// Railway's link in the dump answers 403, its live legacy is on upgrade-exhibitions.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseThematicGalleryLinks, thematicGalleryLinks } from '../tools/lib/legacy-config.mjs';

test('reads each gallery id, its host and its path in English', () => {
  const links = parseThematicGalleryLinks(`<?php return ['links' => ['projects' => ['1' => ['base_url' => 'https://no.example']],
    'thematic_galleries' => [
      '9' => [
          'base_url' => 'https://carpets.museumwnf.org',
          'path' => '',
      ],
      '55' => [
          'base_url' => 'https://upgrade-exhibitions.museumwnf.org/',
          'path' => 'the_hijaz_railway/{lang}',
      ],
  ]]];`);
  assert.equal(links.get(9), 'https://carpets.museumwnf.org/');
  assert.equal(links.get(55), 'https://upgrade-exhibitions.museumwnf.org/the_hijaz_railway/en/');
  assert.equal(links.get(1), undefined);
});

test('the repository config sends the Hijaz Railway to upgrade-exhibitions', () => {
  assert.equal(thematicGalleryLinks().get(55), 'https://upgrade-exhibitions.museumwnf.org/the_hijaz_railway/en/');
});
