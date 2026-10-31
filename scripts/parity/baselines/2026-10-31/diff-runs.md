# Parity run vs baseline

- **baseline:** /var/www/app/scripts/parity/tools/../baselines/2026-10-28b
- **run:** /parity/out
- **real differences (overview):** 7 → 7

## Gate

**FAILED** — 23 regressions:

| Site | What | Baseline | Run |
|---|---|---|---|
| islamicart | field item.image.count | 1 | 2 |
| the-hijaz-railway | field theme.picture count | 3 | 4 |
| baroqueart-absolutism | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/monuments/bar/de/12/1/2.jpg) | 0 | 1 |
| baroqueart-bourgeoisie | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/monuments/bar/it/11/8/9.jpg) | 0 | 1 |
| baroqueart-devotion | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/monuments/bar/de/12/17/2.jpg) | 0 | 1 |
| baroqueart-ephemera | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/monuments/bar/it/11/8/9.jpg) | 0 | 1 |
| baroqueart-languages-baroque | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/museums/hr/11/logos/2.jpg) | 0 | 2 |
| baroqueart-travelling-and-exotism | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/monuments/bar/at/11/7/3.jpg) | 0 | 1 |
| explore | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/explore/locations/409/2.jpg) | 38 | 39 |
| islamicart-artistic-introduction | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/monuments/isl/tn/1/21/8.jpg) | 0 | 2 |
| islamicart-the-ottomans | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/monuments/isl/tr/1/29/6.jpg) | 2 | 3 |
| islamicart | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/objects/epm/on/21/20/3.jpg) | 28 | 29 |
| sharinghistory-cities-and-urban-spaces | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/sharing_history/sh_monuments/awe/lb/38/3.jpg) | 0 | 4 |
| sharinghistory-economy-and-trade | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/sharing_history/sh_partners/AT_01/logos/2.jpg) | 0 | 2 |
| sharinghistory-fine-and-applied-arts | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/sharing_history/sh_partners/AT_01/logos/2.jpg) | 0 | 2 |
| sharinghistory-great-inventions-of-the-19th-century | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/sharing_history/sh_partners/AT_01/logos/2.jpg) | 0 | 2 |
| sharinghistory-international-exhibitions | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/sharing_history/sh_partners/AT_01/logos/2.jpg) | 0 | 2 |
| sharinghistory-migrations | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/sharing_history/sh_partners/TR_02/logos/2.jpg) | 0 | 1 |
| sharinghistory-music-literature-dance-and-fashion | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/sharing_history/sh_partners/TR_02/logos/2.jpg) | 0 | 1 |
| sharinghistory-rediscovering-the-past | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/sharing_history/sh_partners/AT_01/logos/2.jpg) | 0 | 2 |
| sharinghistory-reforms-and-social-changes | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/sharing_history/sh_partners/TR_02/logos/2.jpg) | 0 | 1 |
| sharinghistory-travelling | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/sharing_history/sh_partners/AT_01/logos/2.jpg) | 0 | 2 |
| the-hijaz-railway | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/monuments/isl/pa/1/23/2.jpg) | 4 | 5 |

Not in the baseline, so the package checks judge them strictly and their fields and record sets are not gated: baroqueart-absolutism, baroqueart-bourgeoisie, baroqueart-devotion, baroqueart-enlightenment, baroqueart-ephemera, baroqueart-languages-baroque, baroqueart-reformation, baroqueart-travelling-and-exotism, islamicart-artistic-introduction, sharinghistory-cities-and-urban-spaces, sharinghistory-economy-and-trade, sharinghistory-fine-and-applied-arts, sharinghistory-great-inventions-of-the-19th-century, sharinghistory-international-exhibitions, sharinghistory-migrations, sharinghistory-music-literature-dance-and-fashion, sharinghistory-rediscovering-the-past, sharinghistory-reforms-and-social-changes, sharinghistory-travelling.

## Open package defects

Known in the baseline, so not regressions, but each one is still a place where the site can differ from legacy. Details per URL and text are in `packages.md`. When a count falls, take a new baseline to lock it in.

| Site | Check | Baseline | Run |
|---|---|---|---|
| archaeology | image URLs not /pub/<uuid> | 1 | 1 |
| arms-armoury | image URLs not /pub/<uuid> | 1 | 1 |
| arts-in-dialogue | image URLs not /pub/<uuid> | 2 | 2 |
| baroqueart | image URLs not /pub/<uuid> | 6 | 3 ↓ |
| calligraphy | image URLs not /pub/<uuid> | 7 | 7 |
| carpets | image URLs not /pub/<uuid> | 2 | 2 |
| ceramics | image URLs not /pub/<uuid> | 3 | 3 |
| clothing | image URLs not /pub/<uuid> | 1 | 1 |
| coins-medals | image URLs not /pub/<uuid> | 1 | 1 |
| communication | image URLs not /pub/<uuid> | 1 | 1 |
| explore | texts with raw HTML | 4 | 4 |
| funerary-objects | image URLs not /pub/<uuid> | 1 | 1 |
| glass | image URLs not /pub/<uuid> | 1 | 1 |
| gold-silver | image URLs not /pub/<uuid> | 4 | 4 |
| islamicart-arabic-calligraphy | image URLs not /pub/<uuid> | 3 | 3 |
| islamicart-crusader | image URLs not /pub/<uuid> | 3 | 3 |
| islamicart-fatimids | image URLs not /pub/<uuid> | 2 | 2 |
| islamicart-mudejar-art | image URLs not /pub/<uuid> | 5 | 5 |
| islamicart-muslim-west | image URLs not /pub/<uuid> | 2 | 2 |
| islamicart-pilgrimage | image URLs not /pub/<uuid> | 2 | 2 |
| islamicart-siculo-norman | image URLs not /pub/<uuid> | 2 | 2 |
| islamicart-the-abbasids | image URLs not /pub/<uuid> | 1 | 1 |
| islamicart-the-ayyubids | image URLs not /pub/<uuid> | 2 | 2 |
| islamicart-the-umayyads | image URLs not /pub/<uuid> | 3 | 3 |
| islamicart-water | image URLs not /pub/<uuid> | 5 | 5 |
| islamicart-western-influence | image URLs not /pub/<uuid> | 1 | 1 |
| islamicart-women | image URLs not /pub/<uuid> | 1 | 1 |
| jewellery | image URLs not /pub/<uuid> | 1 | 1 |
| landscapes | image URLs not /pub/<uuid> | 3 | 3 |
| leatherworks | image URLs not /pub/<uuid> | 4 | 4 |
| manuscripts | image URLs not /pub/<uuid> | 3 | 3 |
| metalwork | image URLs not /pub/<uuid> | 2 | 2 |
| paintings | image URLs not /pub/<uuid> | 4 | 4 |
| photographs | image URLs not /pub/<uuid> | 2 | 2 |
| porcelain | image URLs not /pub/<uuid> | 2 | 2 |
| portraits | image URLs not /pub/<uuid> | 1 | 1 |
| precious-stones | image URLs not /pub/<uuid> | 1 | 1 |
| prints-drawings | image URLs not /pub/<uuid> | 1 | 1 |
| religious-life | image URLs not /pub/<uuid> | 5 | 5 |
| sculptures | image URLs not /pub/<uuid> | 3 | 3 |
| sharinghistory | image URLs not /pub/<uuid> | 4 | 4 |
| sharinghistory | texts with raw HTML | 4 | 4 |
| textiles | image URLs not /pub/<uuid> | 2 | 2 |
| the-table-is-set | image URLs not /pub/<uuid> | 2 | 2 |
| the-use-of-colours-in-art | image URLs not /pub/<uuid> | 2 | 2 |
| theatre | image URLs not /pub/<uuid> | 1 | 1 |
| toys-games | image URLs not /pub/<uuid> | 1 | 1 |
| wallpaintings | image URLs not /pub/<uuid> | 1 | 1 |
| water-in-islam | image URLs not /pub/<uuid> | 11 | 11 |
| woodwork | image URLs not /pub/<uuid> | 2 | 2 |

## Fields (real differences = different / missing / extra, summed over the sites of this run)

| Field | Before | After | Δ | Format-only before → after | Compared after | Sites still off |
|---|---|---|---|---|---|---|
| item.alternate_name | 0 | 0 | 0 | 263 → 263 | 18435 | 0 |
| item.artist | 0 | 0 | 0 | 44 → 44 | 19722 | 0 |
| item.artist_birthdate | 3 | 3 | 0 | 0 → 0 | 3 | 1 |
| item.artist_birthplace | 1 | 1 | 0 | 0 → 0 | 1 | 1 |
| item.artist_deathdate | 2 | 2 | 0 | 0 → 0 | 2 | 1 |
| item.artist_deathplace | 1 | 1 | 0 | 0 → 0 | 1 | 1 |
| item.author | 0 | 0 | 0 | 314 → 314 | 29619 | 0 |
| item.bibliography | 0 | 0 | 0 | 8 → 8 | 25136 | 0 |
| item.copy_editor | 7 | 7 | 0 | 4 → 4 | 29619 | 1 |
| item.datation_method | 2 | 2 | 0 | 0 → 0 | 2 | 1 |
| item.dates | 0 | 0 | 0 | 3259 → 3259 | 29296 | 0 |
| item.description | 1 | 1 | 0 | 0 → 0 | 26860 | 1 |
| item.dimensions | 0 | 0 | 0 | 3742 → 3742 | 24479 | 0 |
| item.dynasty (free text) | 0 | 0 | 0 | 1527 → 1527 | 25107 | 0 |
| item.holder | 0 | 0 | 0 | 2371 → 2371 | 26985 | 0 |
| item.initial_owner | 0 | 0 | 0 | 891 → 891 | 18677 | 0 |
| item.location | 0 | 0 | 0 | 8531 → 8531 | 29617 | 0 |
| item.name | 0 | 0 | 0 | 4859 → 4859 | 29615 | 0 |
| item.owner | 0 | 0 | 0 | 316 → 316 | 18143 | 0 |
| item.owner_reference | 6 | 6 | 0 | 68 → 68 | 12641 | 3 |
| item.second_name | 0 | 0 | 0 | 6 → 6 | 298 | 0 |
| item.third_name | 0 | 0 | 0 | 1 → 1 | 543 | 0 |
| item.translation_copy_editor | 1 | 1 | 0 | 0 → 0 | 29619 | 1 |
| membership.sh_exhibition_subthemes (assigned items) | 14 | 14 | 0 | 0 → 0 | 140 | 1 |
| membership.sh_exhibition_themes (assigned items) | 6 | 6 | 0 | 0 → 0 | 42 | 1 |
| membership.sh_exhibitions (assigned items) | 1 | 1 | 0 | 0 → 0 | 10 | 1 |
| membership.Travels monuments (count only) | 2 | 2 | 0 | 0 → 0 | 2 | 2 |
| partner.city | 1 | 1 | 0 | 0 → 0 | 4895 | 1 |
| partner.name | 0 | 0 | 0 | 28 → 28 | 4916 | 0 |
| site.hidden | 1 | 1 | 0 | 0 → 0 | 42 | 1 |
| sub-itinerary.monuments | 1 | 1 | 0 | 0 → 0 | 109 | 1 |
| theme.contextual descriptions (count) | 2 | 2 | 0 | 0 → 0 | 2 | 2 |
| theme.presentation | 15 | 15 | 0 | 0 → 0 | 129 | 2 |
| theme.quote | 16 | 16 | 0 | 0 → 0 | 129 | 1 |
| theme.title | 11 | 11 | 0 | 0 → 0 | 129 | 2 |
| item.image.count | 5 | 6 | +1 | 0 → 0 | 14849 | 3 |
| theme.picture count | 25 | 26 | +1 | 0 → 0 | 129 | 2 |

## Sites

| Site | Real before | Real after | Unexplained before | after | Record sets off (after) |
|---|---|---|---|---|---|
| amulets | 0 | 0 | 0 | 0 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+1 |
| archaeology | 0 | 0 | 0 | 0 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+1 |
| architectural-elements | 0 | 0 | 0 | 0 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+2 |
| arms-armoury | 0 | 0 | 0 | 0 | ✓ |
| arts-in-dialogue | 1 | 1 | 1 | 1 | items (membership): −1/+3; item × language: −0/+22; partners: −1/+5; timeline events (country|year|text, en): −0/+4 |
| baroqueart | 3 | 3 | 0 | 0 | exhibitions: −1/+0; exhibition_themes: −3/+0; partners referenced by records: −4/+12 |
| baroqueart-absolutism | — | — | — | — | ✓ |
| baroqueart-bourgeoisie | — | — | — | — | ✓ |
| baroqueart-devotion | — | — | — | — | ✓ |
| baroqueart-enlightenment | — | — | — | — | ✓ |
| baroqueart-ephemera | — | — | — | — | ✓ |
| baroqueart-languages-baroque | — | — | — | — | ✓ |
| baroqueart-reformation | — | — | — | — | ✓ |
| baroqueart-travelling-and-exotism | — | — | — | — | ✓ |
| calligraphy | 0 | 0 | 0 | 0 | items (membership): −0/+3; item × language: −2/+3; partners: −0/+3 |
| carpets | 0 | 0 | 0 | 0 | ✓ |
| ceramics | 0 | 0 | 0 | 0 | items (membership): −0/+2; item × language: −1/+2; partners: −0/+1 |
| clothing | 0 | 0 | 0 | 0 | items (membership): −0/+7; item × language: −0/+7; partners: −0/+2 |
| coins-medals | 0 | 0 | 0 | 0 | items (membership): −0/+9; item × language: −0/+9; partners: −0/+4 |
| communication | 0 | 0 | 0 | 0 | items (membership): −0/+17; item × language: −0/+17; partners: −0/+8 |
| explore | 0 | 0 | 0 | 0 | ✓ |
| funerary-objects | 0 | 0 | 0 | 0 | ✓ |
| galleries | 0 | 0 | 0 | 0 | ✓ |
| glass | 0 | 0 | 0 | 0 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+2 |
| gold-silver | 0 | 0 | 0 | 0 | items (membership): −0/+5; item × language: −1/+5; partners: −0/+2 |
| historical-cars | 0 | 0 | 0 | 0 | ✓ |
| islamicart | 0 | 0 | 0 | 0 | record × language (dump vs package): −4/+16; partners referenced by records: −10/+1 |
| islamicart-arabic-calligraphy | — | — | — | — | ✓ |
| islamicart-artistic-introduction | — | — | — | — | ✓ |
| islamicart-crusader | — | — | — | — | ✓ |
| islamicart-fatimids | — | — | — | — | ✓ |
| islamicart-figural | — | — | — | — | ✓ |
| islamicart-floral | — | — | — | — | ✓ |
| islamicart-geometric | — | — | — | — | ✓ |
| islamicart-mudejar-art | — | — | — | — | ✓ |
| islamicart-muslim-west | — | — | — | — | ✓ |
| islamicart-pilgrimage | — | — | — | — | ✓ |
| islamicart-siculo-norman | — | — | — | — | ✓ |
| islamicart-the-abbasids | — | — | — | — | ✓ |
| islamicart-the-ayyubids | — | — | — | — | ✓ |
| islamicart-the-mamluks | — | — | — | — | ✓ |
| islamicart-the-ottomans | — | — | — | — | ✓ |
| islamicart-the-umayyads | — | — | — | — | ✓ |
| islamicart-water | — | — | — | — | ✓ |
| islamicart-western-influence | — | — | — | — | ✓ |
| islamicart-women | — | — | — | — | ✓ |
| ivory | 0 | 0 | 0 | 0 | ✓ |
| jewellery | 0 | 0 | 0 | 0 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+1 |
| landscapes | 0 | 0 | 0 | 0 | items (membership): −0/+13; item × language: −0/+13; partners: −0/+5 |
| leatherworks | 0 | 0 | 0 | 0 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+1 |
| manuscripts | 0 | 0 | 0 | 0 | items (membership): −0/+8; item × language: −1/+8; partners: −0/+4 |
| metalwork | 0 | 0 | 0 | 0 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+1 |
| mosaics | 0 | 0 | 0 | 0 | ✓ |
| musical-instruments | 0 | 0 | 0 | 0 | ✓ |
| paintings | 0 | 0 | 0 | 0 | items (membership): −0/+18; item × language: −0/+18; partners: −0/+7 |
| photographs | 0 | 0 | 0 | 0 | items (membership): −0/+100; item × language: −0/+100; partners: −0/+11; countries (items ∪ timeline ∪ partners): −0/+1 |
| porcelain | 0 | 0 | 0 | 0 | ✓ |
| portraits | 0 | 0 | 0 | 0 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+2 |
| precious-stones | 0 | 0 | 0 | 0 | ✓ |
| prints-drawings | 2 | 2 | 0 | 0 | items (membership): −0/+29; item × language: −0/+29; partners: −0/+7 |
| religious-life | 0 | 0 | 0 | 0 | items (membership): −0/+5; item × language: −0/+5; partners: −0/+2 |
| scientific-objects | 1 | 1 | 0 | 0 | items (membership): −0/+3; item × language: −0/+3; partners: −0/+2 |
| sculptures | 0 | 0 | 0 | 0 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+2 |
| sharinghistory | 0 | 0 | 0 | 0 | record × language (dump vs package): −1/+0; partners referenced by records: −0/+15 |
| sharinghistory-cities-and-urban-spaces | — | — | — | — | ✓ |
| sharinghistory-economy-and-trade | — | — | — | — | ✓ |
| sharinghistory-fine-and-applied-arts | — | — | — | — | ✓ |
| sharinghistory-great-inventions-of-the-19th-century | — | — | — | — | ✓ |
| sharinghistory-international-exhibitions | — | — | — | — | ✓ |
| sharinghistory-migrations | — | — | — | — | ✓ |
| sharinghistory-music-literature-dance-and-fashion | — | — | — | — | ✓ |
| sharinghistory-rediscovering-the-past | — | — | — | — | ✓ |
| sharinghistory-reforms-and-social-changes | — | — | — | — | ✓ |
| sharinghistory-travelling | — | — | — | — | ✓ |
| textiles | 0 | 0 | 0 | 0 | items (membership): −0/+9; item × language: −0/+9; partners: −0/+2 |
| the-hijaz-railway | — | — | — | — | ✓ |
| the-table-is-set | 0 | 0 | 0 | 0 | items (membership): −0/+2; item × language: −2/+13; partners: −1/+0 |
| the-use-of-colours-in-art | 0 | 0 | 0 | 0 | items (membership): −1/+1; item × language: −0/+6; partners: −2/+1; timeline events (country|year|text, en): −0/+45 |
| theatre | 0 | 0 | 0 | 0 | ✓ |
| toys-games | 0 | 0 | 0 | 0 | ✓ |
| wallpaintings | 0 | 0 | 0 | 0 | ✓ |
| water-in-islam | 0 | 0 | 0 | 0 | items (membership): −0/+3; item × language: −0/+4; partners: −2/+11 |
| weights-measures | 0 | 0 | 0 | 0 | ✓ |
| with-brush-and-qalam | 0 | 0 | 0 | 0 | ✓ |
| woodwork | 0 | 0 | 0 | 0 | items (membership): −0/+3; item × language: −0/+3; partners: −0/+1 |
