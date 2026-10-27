// node --test scripts/minisites/legacy-minisite.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { curators, deterministicUuid, exhibitionId, mapCount, menuSecondColumnFrom } from './legacy-minisite.mjs'

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
