// Legacy Islamic Art links its glossary terms; the page prints the term whatever its spelling.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePage, sectionText } from '../tools/legacy-php.mjs';

const labels = Object.assign(new Map(), { terms: new Map() });
const page = (content) => `<a href="/"><h3>Discover Islamic Art</h3></a><h3>Description:</h3><p>${content}</p></section>`;
const link = (term) => `<a href="javascript:showGlossary('${term}','en');" style="text-decoration: underline;">${term}</a>`;

test('a glossary link prints its term', () => {
  const { sections } = parsePage(page(`made in <i>${link('lustre')}</i> technique`), 'en', labels);
  assert.equal(sectionText(sections[0]).trim(), 'made in lustre technique');
});

test("a glossary term with an apostrophe still prints (ISL;pa;Mus01;26: rab'a)", () => {
  const { sections } = parsePage(page(`Each part of the <i>${link("rab'a")}</i> begins with two panels.`), 'en', labels);
  assert.equal(sectionText(sections[0]).trim(), "Each part of the rab'a begins with two panels.");
});
