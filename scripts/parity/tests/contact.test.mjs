// Baroque Art's Contact Details box, under the Location of a monument's sheet.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePage } from '../tools/legacy-php.mjs';

const labels = new Map([['en|location', 'db_location'], ['en|date', 'db_period']]);
const page = (location) =>
  `<a href="index.php"><h3>Discover Baroque Art</h3></a><section><h3>Location</h3>${location}<h3>Date</h3><p>1632–39</p></section>`;
const tooltip =
  '<p>Rome, Latium, Italy</p><div class="su_tooltip arrow">Contact Details<span class="su_tooltip-content"><span class="su_tooltip-text">' +
  '<span class="su_tooltip-inner"><span class="icon fa fa-phone"></span><span class="su_tooltip-body">Palazzo Barberini<br/>' +
  'Via delle Quattro Fontane, 13<br/>T : +39 06 4814591<br/></span></span></span></span></div>';

test('the box\'s lines are read, and the Location keeps its own text', () => {
  const { contact, sections } = parsePage(page(tooltip), 'en', labels);
  assert.equal(contact, 'Palazzo Barberini<br/>Via delle Quattro Fontane, 13<br/>T : +39 06 4814591<br/>');
  assert.equal(sections[0].html, '<p>Rome, Latium, Italy</p>');
});

test('a box legacy comments out is no box', () => {
  assert.equal(parsePage(page(`<p>Rome</p><!--${tooltip.slice(21)}-->`), 'en', labels).contact, null);
});
