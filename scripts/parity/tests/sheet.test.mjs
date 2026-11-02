// The lines the PHP sites compose from several package fields, as legacy's database_item.php prints them.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compare } from '../tools/lib/text.mjs';
import { creditPeopleLine, isListed, locationLine } from '../tools/lib/sheet.mjs';

const object = { type: 'object', country_id: 'gbr' };

test('the location line composes the location, the province and the country name', () => {
  const line = locationLine(object, { location: 'London', province: 'England' }, { country: 'United Kingdom' });
  assert.equal(line, 'London, England, United Kingdom');
  assert.equal(compare('<p>London, England, United Kingdom</p>', line).verdict, 'same');
});

test('the location line drops each part\'s ending period, as legacy does', () => {
  assert.equal(locationLine(object, { location: 'Mértola.', province: 'Beja.' }, { country: 'Portugal' }), 'Mértola, Beja, Portugal');
});

test('a record without a province prints the location and the country', () => {
  assert.equal(locationLine(object, { location: 'Cairo' }, { country: 'Egypt' }), 'Cairo, Egypt');
});

test('a record with only a country prints the country', () => {
  assert.equal(locationLine(object, {}, { country: 'Egypt' }), 'Egypt');
});

test('Islamic Art opens a monument\'s line with its address, each of its lines kept', () => {
  const monument = { type: 'monument', country_id: 'tur' };
  const tr = { address: 'Sultanahmet Meydanı\r\nFatih.', location: 'Istanbul' };
  const line = locationLine(monument, tr, { country: 'Turkey', address: true });
  assert.equal(line, 'Sultanahmet Meydanı  \nFatih, Istanbul, Turkey');
  assert.equal(compare('<p>Sultanahmet Meydanı<br />\nFatih, Istanbul, Turkey</p>', line).verdict, 'same');
  assert.equal(locationLine(monument, tr, { country: 'Turkey' }), 'Istanbul, Turkey', 'no address where the site prints none');
});

test('legacy names no country for the Palestinian museum\'s objects nor the listed monuments', () => {
  const pa = { type: 'object', country_id: 'pse' };
  assert.equal(locationLine(pa, { location: 'Jerusalem' }, { country: 'Palestine', partnerKey: 'mwnf3:museums:Mus01:pa' }), 'Jerusalem');
  assert.equal(locationLine(pa, { location: 'Jerusalem' }, { country: 'Palestine', partnerKey: 'mwnf3:museums:Mus02:pa' }), 'Jerusalem, Palestine');
  const monument = { type: 'monument', country_id: 'pse', mwnf_reference: 'PA 05' };
  assert.equal(locationLine(monument, { location: 'Nablus' }, { country: 'Palestine' }), 'Nablus');
  assert.equal(locationLine({ ...monument, mwnf_reference: 'PA 12' }, { location: 'Nablus' }, { country: 'Palestine' }), 'Nablus, Palestine');
});

const people = new Map([
  ['a', { id: 'a', name: 'Barry Wood', originalname: 'باري وود' }],
  ['b', { id: 'b', name: 'Mandi Gomez', originalname: '' }],
]);

test('a credit prints each credited person\'s name, joined', () => {
  assert.equal(creditPeopleLine(['a', 'b'], people, 'en'), 'Barry Wood, Mandi Gomez');
});

test('an Arabic page prints the Arabic spelling, and the Latin name where there is none', () => {
  assert.equal(creditPeopleLine(['a', 'b'], people, 'ar'), 'باري وود, Mandi Gomez');
});

test('a person the package does not carry leaves no line', () => {
  assert.equal(creditPeopleLine(['a', 'z'], people, 'en'), null);
  assert.equal(creditPeopleLine([], people, 'en'), null);
});

test('a collection marked unpublished is not listed', () => {
  assert.equal(isListed({ published: false }), false);
  assert.equal(isListed({ published: true }), true);
  assert.equal(isListed({}), true, 'a package without the flag lists every collection');
});
