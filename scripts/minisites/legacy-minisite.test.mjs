// node --test scripts/minisites/legacy-minisite.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { curators, design, deterministicUuid, exhibitionId, familyFiles, familyOf, mapCount, menuSecondColumnFrom } from './legacy-minisite.mjs'

test('ids are the importer’s own UUIDv5 of the backward_compatibility', () => {
  assert.equal(deterministicUuid('collection:mwnf3:exhibitions:13'), 'da493358-92ba-5a20-8866-fa30fb03bfb2')
  assert.equal(deterministicUuid('partner:mwnf3:museums:mus01:tn'), 'ee0a71f8-dc12-5d5d-b02a-4402969e8274')
})

test('the exhibition is the last assignment the pages run, not a commented-out one', () => {
  const config = `/*\n    $_SESSION["exhibition"] = 15;\n*/\n    $_SESSION["exhibition"] = 13;\n`
  assert.equal(exhibitionId(config), '13')
})

test('reads HOMELOGOS: partners by their legacy key, and names legacy wrote out', () => {
  const config = `
    $HOMELOGOS = array(
        array(
            "name" => $toolclass->getMuseumName("Mus01;tn", '', $mysqli_conn).", ".$NAVLNGCOUNTRIES['tn'],
            "link" => DISCOVERISLAMICART_WEBSITE_URL."/pm_partner.php?theme=ISL&id=Mus01;tn",
            "image" => "../sponsor_logo/TN-13.gif",
            "rightmargin" => "35"
        ),
        array(
            "name" => "EGE University".", Izmir, ".$NAVLNGCOUNTRIES['tr'],
            "link" => "#",
            "image" => "../sponsor_logo/TU-42.gif",
            "rightmargin" => "15"
        )
    );`
  assert.deepEqual(curators(config, { tn: 'tun', tr: 'tur' }), [
    { partner: 'ee0a71f8-dc12-5d5d-b02a-4402969e8274', logo: 'legacy/TN-13.gif', space: 35 },
    { name: 'EGE University, Izmir', country: 'tur', href: '#', logo: 'legacy/TU-42.gif', space: 15 },
  ])
})

test('the menu’s second column, and the maps legacy listed and drew', () => {
  assert.equal(menuSecondColumnFrom('<?php\n$_HOME_MENU_COL2 = 7;\n'), 7)
  assert.equal(menuSecondColumnFrom('<?php\n'), null)
  const isl = '$INTROPAGE_HAVEMAP = array("10","13","27");'
  assert.equal(mapCount(isl, '13', ['map_en.jpg']), 1)
  assert.equal(mapCount(isl, '27', ['map_en.jpg', 'map2_en.jpg']), 2)
  assert.equal(mapCount(isl, '19', ['map_en.jpg']), 0)
})

test('Baroque Art: museum and institution partners, with the city and country printed after the name', () => {
  const config = `
        $HOMELOGOS = array(
        array(
            "name" => $museumToolClass->getMuseumName("Mus11;cz", '', $mysqli_conn).", Brno, ".$NAVLNGCOUNTRIES['cz'],
            "link" => DISCOVERBAROQUEART_WEBSITE_URL . '/pm_partner.php?id=Mus11;cz&type=museum&theme=BAR&',
            "image" => "../sponsor_logo/CZ-46.png",
            "rightmargin" => "35"
        ),
        array(
            "name" => $instToolClass->getInstitutionName("Mon11;hu", '', $mysqli_conn).", Budapest, ".$NAVLNGCOUNTRIES['hu'],
            "link" => DISCOVERBAROQUEART_WEBSITE_URL . "/pm_partner.php?id=Mon11;hu&type=institution&theme=BAR&",
            "image" => "../sponsor_logo/HU-43.png",
            "rightmargin" => "35"
        ));`
  assert.deepEqual(curators(config, { cz: 'cze', hu: 'hun' }), [
    { partner: 'f446146a-791c-5ab5-a762-4bd0263541be', place: 'Brno', country: 'cze', logo: 'legacy/CZ-46.png', space: 35 },
    { partner: '6a136d05-856b-5321-aaeb-eba1b39136a2', place: 'Budapest', country: 'hun', logo: 'legacy/HU-43.png', space: 35 },
  ])
})

test('Baroque Art: an entry with no name and no link keeps its logo', () => {
  const config = `$HOMELOGOS = array(\n array(\n "name" => '',\n "link" => '',\n "image" => "../sponsor_logo/x.gif",\n "rightmargin" => "35"\n ));`
  assert.deepEqual(curators(config, {}), [{ name: '', href: '', logo: 'legacy/x.gif', space: 35 }])
})

test('who designed the exhibition: Baroque Art names one, ISL none', () => {
  const config = `
        $designBy  = 'Yasar University Izmir, Turkey';
        $designLogo  = '../sponsor_logo/yasar.png';
        $designUrl = 'http://www.yasar.edu.tr/en/';`
  assert.deepEqual(design(config), {
    name: 'Yasar University Izmir, Turkey',
    logo: 'legacy/yasar.png',
    href: 'http://www.yasar.edu.tr/en/',
  })
  assert.equal(design('$_SESSION["exhibition"] = 13;'), null)
})

test('the family is the folder the exhibition sits in', () => {
  assert.equal(familyOf('exhibitions/BAR/absolutism').parent, 'baroqueart')
  assert.equal(familyOf('exhibitions/ISL/the_abbasids').exhibitions, 'https://islamicart.museumwnf.org/exhibitions/ISL')
  assert.throws(() => familyOf('exhibitions/SH/travelling'), /no known family/)
})
test("a site reads its family's label set and opens with its family's window title", () => {
  const files = {
    packageJson: '{\n  "name": "x",\n  "viewerI18n": { "class": "minisite", "namespace": "absolutism" }\n}\n',
    indexHtml: '<title>Discover Islamic Art Virtual Exhibitions | Absolutism</title>',
  }
  const own = familyFiles(files, familyOf('exhibitions/BAR/absolutism'))
  assert.deepEqual(JSON.parse(own.packageJson).viewerI18n, { class: 'minisiteBaroque', namespace: 'absolutism' })
  assert.equal(own.indexHtml, '<title>Discover Baroque Art Virtual Museum | Absolutism</title>')
  assert.equal(familyFiles(files, familyOf('exhibitions/ISL/the_abbasids')).indexHtml, files.indexHtml)
})