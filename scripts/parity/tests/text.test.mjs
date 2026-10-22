// A list line from a legacy PHP sheet is compared whole, so a name holding a comma stays one name (#2262).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compare, compareArtistLine, compareJoined } from '../tools/lib/text.mjs';

test('a single name holding a comma matches', () => {
  assert.equal(compareJoined('Jenig, clockmaker', ['Jenig, clockmaker']).verdict, 'same');
});

test('several names match legacy\'s comma-joined line', () => {
  const legacy = 'Franz Ignaz Günther (1725 Altmonstein – 1775 Mnichov), Simon Forstner (před 1714 Salcburk – 1733 Olomouc)';
  assert.equal(compareJoined(legacy, ['Franz Ignaz Günther (1725 Altmonstein – 1775 Mnichov)', 'Simon Forstner (před 1714 Salcburk – 1733 Olomouc)']).verdict, 'same');
});

test('the same names in another order are a format difference', () => {
  const legacy = 'Etching: Giacomo Maria Giovannini (1667, Bologna – 1717, Parma), designer: Marco Antonio Chiarini (1652, Bologna – 1730, Bologna)';
  const r = compareJoined(legacy, ['designer: Marco Antonio Chiarini (1652, Bologna – 1730, Bologna)', 'Etching: Giacomo Maria Giovannini (1667, Bologna – 1717, Parma)']);
  assert.equal(r.verdict, 'format');
  assert.equal(r.why, 'same entries, other order');
});

test('a reordered list with a name missing is still different', () => {
  assert.equal(compareJoined('Jenig, clockmaker, Paolo Pagani', ['Paolo Pagani', 'Simon Forstner']).verdict, 'different');
});

test('another name is still different', () => {
  assert.equal(compareJoined('Jenig, clockmaker', ['Paolo Pagani']).verdict, 'different');
});

test('no names in the package is missing', () => {
  assert.equal(compareJoined('Jenig, clockmaker', undefined).verdict, 'missing-in-package');
});

// Baroque Art prints "artist (birthdate, birthplace-deathdate, deathplace)" from the record's columns.
test('the artist line with life data matches the names plus the translation\'s life fields', () => {
  const tr = { artist_birthdate: '1630 Královec', artist_deathdate: '1706 Lubuš' };
  const r = compareArtistLine('Michael Leopold Willmann&nbsp;(1630 Královec-1706 Lubuš)', ['Michael Leopold Willmann'], tr);
  assert.equal(r.verdict, 'same');
  assert.equal(r.why, 'name + life data from separate fields');
});

test('"Unknown" life data is a value like any other', () => {
  assert.equal(compareArtistLine('Jacinto Vieira (Unknown)', ['Jacinto Vieira'], { artist_birthdate: 'Unknown' }).verdict, 'same');
  assert.equal(compareArtistLine('Heinrich Mannlich (hallmark H.M.) (Unknown, Augsburg)', ['Heinrich Mannlich (hallmark H.M.)'], { artist_birthdate: 'Unknown', artist_birthplace: 'Augsburg' }).verdict, 'same');
});

test('life data the package lacks is still different', () => {
  assert.equal(compareArtistLine('Paolo Pagani (1661 Castello Valsolda-1716 Milano)', ['Paolo Pagani'], {}).verdict, 'different');
  assert.equal(compareArtistLine('Paolo Pagani (1661 Castello Valsolda-1716 Milano)', ['Paolo Pagani'], { artist_birthdate: '1662' }).verdict, 'different');
});

test('legacy\'s named entities decode, the whole Latin-1 set and case-sensitively', () => {
  assert.equal(compare('Portugal Isl&acirc;mico, Pal&aacute;cio Alm&oacute;ada', 'Portugal Islâmico, Palácio Almóada').verdict, 'same');
  assert.equal(compare('&Agrave; &agrave; &AElig;', 'À à Æ').verdict, 'same');
});

test('a double-encoded entity legacy prints literally is still told apart', () => {
  assert.equal(compare('Isl&amp;acirc;mico', 'Islâmico').verdict, 'expected:legacy prints double-encoded entities');
});

test('legacy\'s "</br>" breaks the line like "<br>"', () => {
  assert.equal(compare('1662-1665 (Altaraufbau)</br>1671 (Altargemälde)', '1662-1665 (Altaraufbau)  \n1671 (Altargemälde)').verdict, 'same');
});

test('escaped underscores and asterisks are text, not emphasis', () => {
  assert.equal(compare('- ______. "حفريات مدينة الرقة."', '\\- \\_\\_\\_\\_\\_\\_. "حفريات مدينة الرقة."').verdict, 'same');
  assert.equal(compare('a * b * c', 'a \\* b \\* c').verdict, 'same');
  assert.equal(compare('Kitab al-Aghani', '*Kitab al-Aghani*').verdict, 'same');
});
