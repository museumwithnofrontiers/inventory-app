// A capture is reused only for the address it was taken from (run.mjs --new-url).
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { reusable } from '../tools/lib/captures.mjs';

const dir = mkdtempSync(join(tmpdir(), 'parity-captures-'));
const job = { id: 'islamicart--home--new', url: 'https://museumwithnofrontiers.github.io/islamicart/#/' };

test('a capture of the same address is reused', () => {
  const file = join(dir, 'same.json');
  writeFileSync(file, JSON.stringify({ ...job, status: 200 }));
  assert.equal(reusable(file, job), true);
});

test('a capture of another address is not', () => {
  const file = join(dir, 'other.json');
  writeFileSync(file, JSON.stringify({ ...job, url: 'http://host.docker.internal:4173/#/' }));
  assert.equal(reusable(file, job), false);
});

test('no capture, or an unreadable one, is not', () => {
  assert.equal(reusable(join(dir, 'missing.json'), job), false);
  const file = join(dir, 'broken.json');
  writeFileSync(file, '{');
  assert.equal(reusable(file, job), false);
});
