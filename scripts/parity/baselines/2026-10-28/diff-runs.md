# Parity run vs baseline

- **baseline:** /var/www/app/scripts/parity/tools/../baselines/2026-10-26
- **run:** /parity/out
- **real differences (overview):** 49 → 8

## Gate

**FAILED** — 17 regressions:

| Site | What | Baseline | Run |
|---|---|---|---|
| baroqueart | field membership.exhibition_pages | 0 | 1 |
| the-hijaz-railway | set dump: items (dump membership, Travels excluded): only in the package | 263 | 285 |
| islamicart-arabic-calligraphy | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/objects/isl/it/1/4/3.jpg) | 0 | 3 |
| islamicart-crusader | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/monuments/isl/pa/1/21/4.jpg) | 0 | 3 |
| islamicart-fatimids | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/monuments/isl/it/1/4/2.jpg) | 0 | 2 |
| islamicart-mudejar-art | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/monuments/isl/es/1/33/2.jpg) | 0 | 5 |
| islamicart-muslim-west | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/monuments/isl/pt/1/11/2.jpg) | 0 | 2 |
| islamicart-pilgrimage | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/monuments/isl/pa/1/21/4.jpg) | 0 | 2 |
| islamicart-siculo-norman | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/monuments/isl/it/1/4/2.jpg) | 0 | 2 |
| islamicart-the-abbasids | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/monuments/isl/tn/1/9/6.jpg) | 0 | 1 |
| islamicart-the-ayyubids | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/) | 0 | 2 |
| islamicart-the-ottomans | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/monuments/isl/tr/1/29/6.jpg) | 0 | 2 |
| islamicart-the-umayyads | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/monuments/isl/pa/1/23/2.jpg) | 0 | 3 |
| islamicart-water | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/monuments/isl/pa/1/16/7.jpg) | 0 | 5 |
| islamicart-western-influence | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/monuments/isl/tr/1/29/6.jpg) | 0 | 1 |
| islamicart-women | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/monuments/isl/it/1/9/2.jpg) | 0 | 1 |
| the-hijaz-railway | package image URLs not /pub/<uuid> (e.g. https://inventory.metanull.eu/pub/objects/galex5/uk/92/2/2.jpg) | 10 | 17 |

Not in the baseline, so the package checks judge them strictly and their fields and record sets are not gated: islamicart-arabic-calligraphy, islamicart-crusader, islamicart-fatimids, islamicart-figural, islamicart-floral, islamicart-geometric, islamicart-mudejar-art, islamicart-muslim-west, islamicart-pilgrimage, islamicart-siculo-norman, islamicart-the-abbasids, islamicart-the-ayyubids, islamicart-the-mamluks, islamicart-the-ottomans, islamicart-the-umayyads, islamicart-water, islamicart-western-influence, islamicart-women.

## Open package defects

Known in the baseline, so not regressions, but each one is still a place where the site can differ from legacy. Details per URL and text are in `packages.md`. When a count falls, take a new baseline to lock it in.

| Site | Check | Baseline | Run |
|---|---|---|---|
| archaeology | image URLs not /pub/<uuid> | 1 | 1 |
| arms-armoury | image URLs not /pub/<uuid> | 1 | 1 |
| arts-in-dialogue | image URLs not /pub/<uuid> | 2 | 2 |
| baroqueart | image URLs not /pub/<uuid> | 280 | 275 ↓ |
| calligraphy | image URLs not /pub/<uuid> | 7 | 7 |
| carpets | image URLs not /pub/<uuid> | 2 | 2 |
| ceramics | image URLs not /pub/<uuid> | 3 | 3 |
| clothing | image URLs not /pub/<uuid> | 1 | 1 |
| coins-medals | image URLs not /pub/<uuid> | 1 | 1 |
| communication | image URLs not /pub/<uuid> | 1 | 1 |
| explore | image URLs not /pub/<uuid> | 38 | 38 |
| explore | texts with raw HTML | 4 | 4 |
| funerary-objects | image URLs not /pub/<uuid> | 1 | 1 |
| glass | image URLs not /pub/<uuid> | 1 | 1 |
| gold-silver | image URLs not /pub/<uuid> | 4 | 4 |
| islamicart | image URLs not /pub/<uuid> | 28 | 28 |
| jewellery | image URLs not /pub/<uuid> | 1 | 1 |
| landscapes | image URLs not /pub/<uuid> | 3 | 3 |
| leatherworks | image URLs not /pub/<uuid> | 4 | 4 |
| manuscripts | image URLs not /pub/<uuid> | 3 | 3 |
| metalwork | image URLs not /pub/<uuid> | 2 | 2 |
| paintings | image URLs not /pub/<uuid> | 4 | 4 |
| photographs | image URLs not /pub/<uuid> | 9 | 9 |
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
| item.description | 11 | 1 | -10 | 0 → 0 | 26860 | 1 |
| partner.city | 9 | 1 | -8 | 0 → 0 | 4895 | 1 |
| item.author | 5 | 0 | -5 | 314 → 314 | 29619 | 0 |
| item.short_description | 5 | 0 | -5 | 0 → 0 | 23885 | 0 |
| item.image.photographer | 3 | 0 | -3 | 0 → 0 | 17718 | 0 |
| item.method_for_datation | 2 | 0 | -2 | 0 → 0 | 24871 | 0 |
| item.translation_copy_editor | 3 | 1 | -2 | 0 → 0 | 29619 | 1 |
| partner.name | 2 | 0 | -2 | 28 → 28 | 4916 | 0 |
| detail.description | 1 | 0 | -1 | 0 → 0 | 1628 | 0 |
| exhibition.related content | 1 | 0 | -1 | 0 → 0 | 5 | 0 |
| membership.sh_exhibition_subthemes (assigned ∪ slideshow items) | 1 | 0 | -1 | 0 → 0 | 140 | 0 |
| partner.languages | 1 | 0 | -1 | 0 → 0 | 2091 | 0 |
| record.package language | 1 | 0 | -1 | 0 → 0 | 4 | 0 |
| site.banner item | 1 | 0 | -1 | 0 → 0 | 42 | 0 |
| item.alternate_name | 0 | 0 | 0 | 264 → 263 | 18435 | 0 |
| item.artist | 0 | 0 | 0 | 44 → 44 | 19722 | 0 |
| item.artist_birthdate | 3 | 3 | 0 | 0 → 0 | 3 | 1 |
| item.artist_birthplace | 1 | 1 | 0 | 0 → 0 | 1 | 1 |
| item.artist_deathdate | 2 | 2 | 0 | 0 → 0 | 2 | 1 |
| item.artist_deathplace | 1 | 1 | 0 | 0 → 0 | 1 | 1 |
| item.bibliography | 0 | 0 | 0 | 22 → 8 | 25136 | 0 |
| item.copy_editor | 7 | 7 | 0 | 4 → 4 | 29619 | 1 |
| item.datation_method | 2 | 2 | 0 | 0 → 0 | 2 | 1 |
| item.dates | 0 | 0 | 0 | 3259 → 3259 | 29296 | 0 |
| item.dimensions | 0 | 0 | 0 | 3742 → 3742 | 24479 | 0 |
| item.dynasty (free text) | 0 | 0 | 0 | 1527 → 1527 | 25107 | 0 |
| item.holder | 0 | 0 | 0 | 2371 → 2371 | 26985 | 0 |
| item.image.count | 5 | 5 | 0 | 0 → 0 | 14849 | 3 |
| item.initial_owner | 0 | 0 | 0 | 891 → 891 | 18677 | 0 |
| item.location | 0 | 0 | 0 | 8531 → 8531 | 29617 | 0 |
| item.name | 0 | 0 | 0 | 4863 → 4859 | 29615 | 0 |
| item.owner | 0 | 0 | 0 | 316 → 316 | 18143 | 0 |
| item.owner_reference | 6 | 6 | 0 | 68 → 68 | 12641 | 3 |
| item.second_name | 0 | 0 | 0 | 6 → 6 | 298 | 0 |
| item.third_name | 0 | 0 | 0 | 1 → 1 | 543 | 0 |
| membership.sh_exhibition_subthemes (assigned items) | 14 | 14 | 0 | 0 → 0 | 140 | 1 |
| membership.sh_exhibition_themes (assigned items) | 6 | 6 | 0 | 0 → 0 | 42 | 1 |
| membership.sh_exhibitions (assigned items) | 1 | 1 | 0 | 0 → 0 | 10 | 1 |
| membership.Travels monuments (count only) | 2 | 2 | 0 | 0 → 0 | 2 | 2 |
| site.hidden | 1 | 1 | 0 | 0 → 0 | 42 | 1 |
| sub-itinerary.monuments | 1 | 1 | 0 | 0 → 0 | 109 | 1 |
| theme.contextual descriptions (count) | 2 | 2 | 0 | 0 → 0 | 2 | 2 |
| theme.picture count | 25 | 25 | 0 | 0 → 0 | 129 | 2 |
| theme.presentation | 15 | 15 | 0 | 0 → 0 | 129 | 2 |
| theme.quote | 16 | 16 | 0 | 0 → 0 | 129 | 1 |
| theme.title | 11 | 11 | 0 | 0 → 0 | 129 | 2 |
| membership.exhibition_pages | 0 | 1 | +1 | 0 → 0 | 390 | 1 |

## Sites

| Site | Real before | Real after | Unexplained before | after | Record sets off (after) |
|---|---|---|---|---|---|
| amulets | 0 | 0 | 0 | 0 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+1 |
| archaeology | 0 | 0 | 0 | 0 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+1 |
| architectural-elements | 0 | 0 | 0 | 0 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+2 |
| arms-armoury | 0 | 0 | 0 | 0 | ✓ |
| arts-in-dialogue | 7 | 1 | 7 | 1 | items (membership): −1/+3; item × language: −0/+22; partners: −1/+5; timeline events (country|year|text, en): −0/+4 |
| baroqueart | 4 | 4 | 0 | 1 | exhibitions: −1/+0; exhibition_themes: −3/+0; partners referenced by records: −4/+12 |
| calligraphy | 2 | 0 | 2 | 0 | items (membership): −0/+3; item × language: −2/+3; partners: −0/+3 |
| carpets | 1 | 0 | 1 | 0 | ✓ |
| ceramics | 2 | 0 | 2 | 0 | items (membership): −0/+2; item × language: −1/+2; partners: −0/+1 |
| clothing | 1 | 0 | 1 | 0 | items (membership): −0/+7; item × language: −0/+7; partners: −0/+2 |
| coins-medals | 0 | 0 | 0 | 0 | items (membership): −0/+9; item × language: −0/+9; partners: −0/+4 |
| communication | 0 | 0 | 0 | 0 | items (membership): −0/+17; item × language: −0/+17; partners: −0/+8 |
| explore | 0 | 0 | 0 | 0 | ✓ |
| funerary-objects | 1 | 0 | 1 | 0 | ✓ |
| galleries | 0 | 0 | 0 | 0 | ✓ |
| glass | 0 | 0 | 0 | 0 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+2 |
| gold-silver | 1 | 0 | 1 | 0 | items (membership): −0/+5; item × language: −1/+5; partners: −0/+2 |
| historical-cars | 0 | 0 | 0 | 0 | ✓ |
| islamicart | 12 | 0 | 12 | 0 | record × language (dump vs package): −4/+16; partners referenced by records: −10/+1 |
| islamicart-arabic-calligraphy | — | — | — | — | ✓ |
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
| jewellery | 1 | 0 | 1 | 0 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+1 |
| landscapes | 0 | 0 | 0 | 0 | items (membership): −0/+13; item × language: −0/+13; partners: −0/+5 |
| leatherworks | 1 | 0 | 1 | 0 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+1 |
| manuscripts | 0 | 0 | 0 | 0 | items (membership): −0/+8; item × language: −1/+8; partners: −0/+4 |
| metalwork | 0 | 0 | 0 | 0 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+1 |
| mosaics | 0 | 0 | 0 | 0 | ✓ |
| musical-instruments | 0 | 0 | 0 | 0 | ✓ |
| paintings | 0 | 0 | 0 | 0 | items (membership): −0/+18; item × language: −0/+18; partners: −0/+7 |
| photographs | 1 | 0 | 1 | 0 | items (membership): −0/+100; item × language: −0/+100; partners: −0/+11; countries (items ∪ timeline ∪ partners): −0/+1 |
| porcelain | 0 | 0 | 0 | 0 | ✓ |
| portraits | 1 | 0 | 1 | 0 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+2 |
| precious-stones | 0 | 0 | 0 | 0 | ✓ |
| prints-drawings | 3 | 2 | 1 | 0 | items (membership): −0/+29; item × language: −0/+29; partners: −0/+7 |
| religious-life | 0 | 0 | 0 | 0 | items (membership): −0/+5; item × language: −0/+5; partners: −0/+2 |
| scientific-objects | 2 | 1 | 1 | 0 | items (membership): −0/+3; item × language: −0/+3; partners: −0/+2 |
| sculptures | 0 | 0 | 0 | 0 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+2 |
| sharinghistory | 3 | 0 | 3 | 0 | record × language (dump vs package): −1/+0; partners referenced by records: −0/+15 |
| textiles | 0 | 0 | 0 | 0 | items (membership): −0/+9; item × language: −0/+9; partners: −0/+2 |
| the-hijaz-railway | — | — | — | — | ✓ |
| the-table-is-set | 3 | 0 | 3 | 0 | items (membership): −0/+2; item × language: −2/+13; partners: −1/+0 |
| the-use-of-colours-in-art | 0 | 0 | 0 | 0 | items (membership): −1/+1; item × language: −0/+6; partners: −2/+1; timeline events (country|year|text, en): −0/+45 |
| theatre | 0 | 0 | 0 | 0 | ✓ |
| toys-games | 0 | 0 | 0 | 0 | ✓ |
| wallpaintings | 0 | 0 | 0 | 0 | ✓ |
| water-in-islam | 2 | 0 | 2 | 0 | items (membership): −0/+3; item × language: −0/+4; partners: −2/+11 |
| weights-measures | 0 | 0 | 0 | 0 | ✓ |
| with-brush-and-qalam | 0 | 0 | 0 | 0 | ✓ |
| woodwork | 1 | 0 | 1 | 0 | items (membership): −0/+3; item × language: −0/+3; partners: −0/+1 |
