# Parity run vs baseline

- **baseline:** /parity/runs/2026-10-18
- **run:** /parity/runs/2026-10-19
- **real differences (overview):** 58194 → 9144

## Gate

**FAILED** — 34 regressions:

| Site | What | Baseline | Run |
|---|---|---|---|
| architectural-elements | field item.bibliography | 13 | 15 |
| calligraphy | field item.bibliography | 52 | 66 |
| ceramics | field item.bibliography | 24 | 42 |
| coins-medals | field package.image URL is /pub/<uuid> | 26 | 27 |
| explore | field package.image URL is /pub/<uuid> | 34 | 41 |
| funerary-objects | field item.bibliography | 5 | 10 |
| glass | field item.bibliography | 6 | 8 |
| gold-silver | field package.image URL is /pub/<uuid> | 19 | 20 |
| islamicart | field item.materials | 0 | 2220 |
| islamicart | field item.bibliography | 152 | 186 |
| islamicart | set report: record × language (dump vs package): only in the package | 15 | 16 |
| ivory | field item.bibliography | 8 | 10 |
| metalwork | field item.bibliography | 17 | 18 |
| paintings | field package.image URL is /pub/<uuid> | 27 | 29 |
| photographs | field package.image URL is /pub/<uuid> | 137 | 162 |
| photographs | set report: items (membership): only in the package | 83 | 100 |
| photographs | set report: item × language: only in the package | 83 | 100 |
| photographs | set report: partners: only in the package | 10 | 11 |
| prints-drawings | field package.image URL is /pub/<uuid> | 41 | 42 |
| religious-life | field item.bibliography | 8 | 10 |
| sculptures | field package.image URL is /pub/<uuid> | 7 | 11 |
| sculptures | set report: items (membership): only in the package | 1 | 2 |
| sculptures | set report: item × language: only in the package | 1 | 2 |
| sculptures | set report: partners: only in the package | 1 | 2 |
| sharinghistory | field item.description | 2 | 8 |
| sharinghistory | field item.history | 0 | 4 |
| textiles | field item.bibliography | 0 | 2 |
| the-hijaz-railway | field theme.presentation | 0 | 3 |
| the-hijaz-railway | field theme.picture count | 1 | 3 |
| the-hijaz-railway | set dump: items (dump membership, Travels excluded): only in the package | 228 | 259 |
| the-table-is-set | field item.bibliography | 9 | 11 |
| water-in-islam | field item.bibliography | 11 | 13 |
| weights-measures | field item.bibliography | 0 | 2 |
| woodwork | field item.bibliography | 11 | 14 |

## Open package defects

Known in the baseline, so not regressions, but each one is still a place where the site can differ from legacy. Details per URL and text are in `packages.md`. When a count falls, take a new baseline to lock it in.

| Site | Check | Baseline | Run |
|---|---|---|---|
| amulets | image URLs not /pub/<uuid> | not measured | 5 |
| archaeology | image URLs not /pub/<uuid> | not measured | 6 |
| architectural-elements | image URLs not /pub/<uuid> | not measured | 8 |
| architectural-elements | texts with raw HTML | not measured | 2 |
| arms-armoury | image URLs not /pub/<uuid> | not measured | 1 |
| arts-in-dialogue | image URLs not /pub/<uuid> | not measured | 2 |
| baroqueart | image URLs not /pub/<uuid> | not measured | 280 |
| calligraphy | image URLs not /pub/<uuid> | not measured | 19 |
| calligraphy | texts with raw HTML | not measured | 15 |
| carpets | image URLs not /pub/<uuid> | not measured | 2 |
| ceramics | image URLs not /pub/<uuid> | not measured | 6 |
| ceramics | texts with raw HTML | not measured | 18 |
| clothing | image URLs not /pub/<uuid> | not measured | 17 |
| coins-medals | image URLs not /pub/<uuid> | not measured | 28 |
| coins-medals | texts with raw HTML | not measured | 1 |
| communication | image URLs not /pub/<uuid> | not measured | 27 |
| explore | image URLs not /pub/<uuid> | not measured | 45 |
| explore | texts with raw HTML | not measured | 14 |
| funerary-objects | image URLs not /pub/<uuid> | not measured | 1 |
| funerary-objects | texts with raw HTML | not measured | 5 |
| glass | image URLs not /pub/<uuid> | not measured | 1 |
| glass | texts with raw HTML | not measured | 2 |
| gold-silver | image URLs not /pub/<uuid> | not measured | 20 |
| islamicart | image URLs not /pub/<uuid> | not measured | 28 |
| islamicart | texts with raw HTML | not measured | 34 |
| ivory | texts with raw HTML | not measured | 2 |
| jewellery | image URLs not /pub/<uuid> | not measured | 7 |
| landscapes | image URLs not /pub/<uuid> | not measured | 70 |
| leatherworks | image URLs not /pub/<uuid> | not measured | 7 |
| manuscripts | image URLs not /pub/<uuid> | not measured | 59 |
| manuscripts | texts with raw HTML | not measured | 1 |
| metalwork | image URLs not /pub/<uuid> | not measured | 5 |
| metalwork | texts with raw HTML | not measured | 1 |
| paintings | image URLs not /pub/<uuid> | not measured | 29 |
| photographs | image URLs not /pub/<uuid> | not measured | 163 |
| photographs | texts with raw HTML | not measured | 1 |
| porcelain | image URLs not /pub/<uuid> | not measured | 2 |
| portraits | image URLs not /pub/<uuid> | not measured | 4 |
| precious-stones | image URLs not /pub/<uuid> | not measured | 1 |
| prints-drawings | image URLs not /pub/<uuid> | not measured | 42 |
| religious-life | image URLs not /pub/<uuid> | not measured | 16 |
| religious-life | texts with raw HTML | not measured | 2 |
| scientific-objects | image URLs not /pub/<uuid> | not measured | 8 |
| sculptures | image URLs not /pub/<uuid> | not measured | 11 |
| sharinghistory | image URLs not /pub/<uuid> | not measured | 4 |
| sharinghistory | texts with raw HTML | not measured | 10 |
| textiles | image URLs not /pub/<uuid> | not measured | 17 |
| textiles | texts with raw HTML | not measured | 2 |
| the-hijaz-railway | image URLs not /pub/<uuid> | not measured | 461 |
| the-table-is-set | image URLs not /pub/<uuid> | not measured | 2 |
| the-table-is-set | texts with raw HTML | not measured | 2 |
| the-use-of-colours-in-art | image URLs not /pub/<uuid> | not measured | 2 |
| theatre | image URLs not /pub/<uuid> | not measured | 1 |
| toys-games | image URLs not /pub/<uuid> | not measured | 1 |
| wallpaintings | image URLs not /pub/<uuid> | not measured | 1 |
| water-in-islam | image URLs not /pub/<uuid> | not measured | 32 |
| water-in-islam | texts with raw HTML | not measured | 2 |
| weights-measures | texts with raw HTML | not measured | 2 |
| woodwork | image URLs not /pub/<uuid> | not measured | 12 |
| woodwork | texts with raw HTML | not measured | 3 |

## Fields (real differences = different / missing / extra, summed over the sites of this run)

| Field | Before | After | Δ | Format-only before → after | Compared after | Sites still off |
|---|---|---|---|---|---|---|
| item.dynasty (free text) | 19116 | 7 | -19109 | 0 → 1527 | 25107 | 5 |
| item.translator | 5531 | 178 | -5353 | 4660 → 4945 | 29619 | 6 |
| item.materials | 7496 | 2256 | -5240 | 1180 → 2063 | 24639 | 17 |
| item.author | 6748 | 2633 | -4115 | 7391 → 8508 | 29619 | 41 |
| item.keywords | 4625 | 637 | -3988 | 9069 → 9277 | 17718 | 33 |
| item.short_description | 3742 | 53 | -3689 | 34 → 51 | 23885 | 18 |
| item.description | 2788 | 112 | -2676 | 336 → 332 | 29089 | 16 |
| item.materials (in tags) | 2610 | 0 | -2610 | 3814 → 502 | 502 | 0 |
| item.copy_editor | 3090 | 1528 | -1562 | 7222 → 7246 | 29619 | 32 |
| item.translation_copy_editor | 2751 | 1470 | -1281 | 4048 → 4070 | 29619 | 28 |
| item.dimensions | 998 | 5 | -993 | 3821 → 3823 | 24479 | 2 |
| item.location | 1093 | 124 | -969 | 10747 → 11560 | 29617 | 24 |
| item.alternate_name | 783 | 8 | -775 | 273 → 273 | 19214 | 3 |
| item.copyright | 51 | 0 | -51 | 0 → 0 | 18160 | 0 |
| item.method_for_provenance | 25 | 4 | -21 | 0 → 3 | 21545 | 3 |
| item.obtention | 20 | 2 | -18 | 15 → 18 | 22799 | 2 |
| item.method_for_datation | 28 | 12 | -16 | 25 → 25 | 24871 | 6 |
| partner.description | 50 | 38 | -12 | 72 → 72 | 4675 | 26 |
| item.name | 14 | 5 | -9 | 4978 → 4978 | 29615 | 5 |
| item.history | 15 | 7 | -8 | 244 → 240 | 1259 | 3 |
| item.dates | 13 | 7 | -6 | 3258 → 3259 | 29296 | 5 |
| item.holder | 35 | 29 | -6 | 2370 → 2370 | 27006 | 7 |
| item.provenance | 9 | 3 | -6 | 6 → 6 | 24699 | 3 |
| item.binding_desc | 3 | 0 | -3 | 0 → 0 | 17448 | 0 |
| item.catalogue_holding_link | 3 | 0 | -3 | 0 → 0 | 17507 | 0 |
| item.scriber | 3 | 0 | -3 | 0 → 0 | 17424 | 0 |
| record.package language | 7 | 4 | -3 | 0 → 0 | 4 | 1 |
| item.owner | 1 | 0 | -1 | 316 → 316 | 18143 | 0 |
| item.type | 7 | 6 | -1 | 1 → 1 | 20931 | 6 |
| location.info | 1 | 0 | -1 | 5 → 5 | 11 | 0 |
| country.description | 1 | 1 | 0 | 0 → 0 | 25 | 1 |
| country.name | 4 | 4 | 0 | 0 → 0 | 169 | 1 |
| detail.artist | 109 | 109 | 0 | 0 → 0 | 1522 | 1 |
| detail.dates | 17 | 17 | 0 | 0 → 0 | 1624 | 1 |
| detail.description | 177 | 177 | 0 | 20 → 20 | 1624 | 1 |
| detail.heading | 22 | 22 | 0 | 0 → 0 | 22 | 1 |
| detail.location | 6 | 6 | 0 | 0 → 0 | 1624 | 1 |
| event.date text.en | 84 | 84 | 0 | 0 → 0 | 58380 | 42 |
| exhibition.related content | 1 | 1 | 0 | 0 → 0 | 5 | 1 |
| item.architects | 0 | 0 | 0 | 100 → 100 | 1333 | 0 |
| item.artist | 1303 | 1303 | 0 | 38 → 38 | 10686 | 39 |
| item.artist_birthdate | 3 | 3 | 0 | 0 → 0 | 3 | 1 |
| item.artist_birthplace | 1 | 1 | 0 | 0 → 0 | 1 | 1 |
| item.artist_deathdate | 2 | 2 | 0 | 0 → 0 | 2 | 1 |
| item.artist_deathplace | 1 | 1 | 0 | 0 → 0 | 1 | 1 |
| item.country_id_present_days | 22 | 22 | 0 | 0 → 0 | 22 | 1 |
| item.datation_method | 2 | 2 | 0 | 0 → 0 | 2 | 1 |
| item.dynasties | 702 | 702 | 0 | 0 → 0 | 17718 | 36 |
| item.dynasty line → a linked dynasty exists | 260 | 260 | 0 | 7128 → 7129 | 7389 | 2 |
| item.image.copyright | 3195 | 3195 | 0 | 0 → 0 | 14663 | 40 |
| item.image.count | 57 | 57 | 0 | 0 → 0 | 14849 | 10 |
| item.image.photographer | 212 | 212 | 0 | 0 → 0 | 14663 | 26 |
| item.initial_owner | 0 | 0 | 0 | 891 → 891 | 18677 | 0 |
| item.media | 33 | 33 | 0 | 0 → 0 | 9173 | 18 |
| item.monument_contact | 38 | 38 | 0 | 0 → 0 | 38 | 1 |
| item.mwnf_reference | 5 | 5 | 0 | 0 → 0 | 12427 | 3 |
| item.notice | 149 | 149 | 0 | 0 → 0 | 149 | 1 |
| item.notice_c | 197 | 197 | 0 | 0 → 0 | 197 | 1 |
| item.other galleries | 90 | 90 | 0 | 0 → 0 | 9173 | 18 |
| item.owner_reference | 53 | 53 | 0 | 68 → 68 | 12641 | 18 |
| item.patrons | 2 | 2 | 0 | 4 → 4 | 2010 | 2 |
| item.start/end | 53 | 53 | 0 | 0 → 0 | 9173 | 9 |
| item.structured_bibliography | 98 | 98 | 0 | 0 → 0 | 98 | 1 |
| location.how_to_reach | 0 | 0 | 0 | 2 → 2 | 22 | 0 |
| location.name | 14 | 14 | 0 | 1 → 1 | 649 | 1 |
| membership.sh_exhibition_subthemes (assigned ∪ slideshow items) | 1 | 1 | 0 | 0 → 0 | 140 | 1 |
| membership.sh_exhibition_subthemes (assigned items) | 14 | 14 | 0 | 0 → 0 | 140 | 1 |
| membership.sh_exhibition_themes (assigned items) | 6 | 6 | 0 | 0 → 0 | 42 | 1 |
| membership.sh_exhibitions (assigned items) | 1 | 1 | 0 | 0 → 0 | 10 | 1 |
| membership.Travels monuments (count only) | 2 | 2 | 0 | 0 → 0 | 2 | 2 |
| package.item partner_id resolves | 497 | 497 | 0 | 0 → 0 | 14474 | 4 |
| partner.city | 9 | 9 | 0 | 0 → 0 | 4896 | 9 |
| partner.languages | 48 | 48 | 0 | 0 → 0 | 2091 | 31 |
| partner.name | 2 | 2 | 0 | 28 → 28 | 4917 | 2 |
| site.banner item | 1 | 1 | 0 | 0 → 0 | 42 | 1 |
| sub-itinerary.monuments | 1 | 1 | 0 | 0 → 0 | 109 | 1 |
| territory.description | 2 | 2 | 0 | 0 → 0 | 50 | 1 |
| territory.name | 2 | 2 | 0 | 0 → 0 | 50 | 1 |
| theme.contextual descriptions (count) | 2 | 2 | 0 | 0 → 0 | 2 | 2 |
| theme.quote | 16 | 16 | 0 | 0 → 0 | 129 | 1 |
| theme.title | 11 | 11 | 0 | 0 → 0 | 129 | 2 |
| theme.picture count | 23 | 25 | +2 | 0 → 0 | 129 | 2 |
| theme.presentation | 11 | 14 | +3 | 0 → 0 | 129 | 2 |
| package.image URL is /pub/<uuid> | 658 | 699 | +41 | 0 → 0 | 47822 | 40 |
| item.bibliography | 482 | 571 | +89 | 72 → 72 | 25136 | 36 |

## Sites

| Site | Real before | Real after | Unexplained before | after | Record sets off (after) |
|---|---|---|---|---|---|
| amulets | 244 | 20 | 131 | 12 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+1 |
| archaeology | 951 | 90 | 594 | 58 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+1 |
| architectural-elements | 960 | 90 | 525 | 66 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+2 |
| arms-armoury | 522 | 28 | 305 | 19 | ✓ |
| arts-in-dialogue | 165 | 25 | 92 | 24 | items (membership): −1/+3; item × language: −0/+22; partners: −1/+5; timeline events (country|year|text, en): −0/+4 |
| baroqueart | 2313 | 816 | 1650 | 599 | exhibitions: −1/+0; exhibition_themes: −3/+0; partners referenced by records: −4/+12 |
| calligraphy | 5462 | 471 | 2805 | 313 | items (membership): −0/+3; item × language: −2/+3; partners: −0/+3 |
| carpets | 1028 | 49 | 449 | 27 | ✓ |
| ceramics | 4010 | 343 | 2018 | 181 | items (membership): −0/+2; item × language: −1/+2; partners: −0/+1 |
| clothing | 1063 | 71 | 681 | 56 | items (membership): −0/+7; item × language: −0/+7; partners: −0/+2 |
| coins-medals | 432 | 74 | 334 | 68 | items (membership): −0/+9; item × language: −0/+9; partners: −0/+4 |
| communication | 344 | 55 | 306 | 55 | items (membership): −0/+17; item × language: −0/+17; partners: −0/+8 |
| explore | 58 | 64 | 58 | 64 | ✓ |
| funerary-objects | 407 | 64 | 222 | 47 | ✓ |
| galleries | 0 | 0 | 0 | 0 | ✓ |
| glass | 1259 | 96 | 629 | 55 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+2 |
| gold-silver | 511 | 47 | 286 | 39 | items (membership): −0/+5; item × language: −1/+5; partners: −0/+2 |
| historical-cars | 146 | 8 | 33 | 8 | ✓ |
| islamicart | 16510 | 3837 | 8567 | 3184 | record × language (dump vs package): −4/+16; partners referenced by records: −10/+1 |
| ivory | 442 | 39 | 219 | 20 | ✓ |
| jewellery | 797 | 65 | 524 | 48 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+1 |
| landscapes | 383 | 116 | 329 | 112 | items (membership): −0/+13; item × language: −0/+13; partners: −0/+5 |
| leatherworks | 270 | 19 | 137 | 14 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+1 |
| manuscripts | 1844 | 173 | 986 | 149 | items (membership): −0/+8; item × language: −1/+8; partners: −0/+4 |
| metalwork | 2290 | 162 | 1257 | 113 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+1 |
| mosaics | 100 | 11 | 66 | 8 | ✓ |
| musical-instruments | 110 | 3 | 67 | 3 | ✓ |
| paintings | 1490 | 242 | 1000 | 210 | items (membership): −0/+18; item × language: −0/+18; partners: −0/+7 |
| photographs | 1613 | 371 | 1539 | 371 | items (membership): −0/+100; item × language: −0/+100; partners: −0/+11; countries (items ∪ timeline ∪ partners): −0/+1 |
| porcelain | 54 | 5 | 40 | 5 | ✓ |
| portraits | 787 | 111 | 644 | 105 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+2 |
| precious-stones | 379 | 22 | 208 | 21 | ✓ |
| prints-drawings | 2259 | 387 | 2122 | 377 | items (membership): −0/+29; item × language: −0/+29; partners: −0/+7 |
| religious-life | 1241 | 105 | 624 | 74 | items (membership): −0/+5; item × language: −0/+5; partners: −0/+2 |
| scientific-objects | 302 | 40 | 193 | 30 | items (membership): −0/+3; item × language: −0/+3; partners: −0/+2 |
| sculptures | 658 | 66 | 336 | 45 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+2 |
| sharinghistory | 484 | 312 | 302 | 311 | record × language (dump vs package): −1/+0; partners referenced by records: −0/+15 |
| textiles | 895 | 78 | 460 | 53 | items (membership): −0/+9; item × language: −0/+9; partners: −0/+2 |
| the-hijaz-railway | — | — | — | — | ✓ |
| the-table-is-set | 1346 | 126 | 731 | 90 | items (membership): −0/+2; item × language: −2/+13; partners: −1/+0 |
| the-use-of-colours-in-art | 614 | 97 | 400 | 85 | items (membership): −1/+1; item × language: −0/+6; partners: −2/+1; timeline events (country|year|text, en): −0/+45 |
| theatre | 89 | 13 | 76 | 13 | ✓ |
| toys-games | 57 | 4 | 27 | 2 | ✓ |
| wallpaintings | 123 | 11 | 75 | 10 | ✓ |
| water-in-islam | 1535 | 149 | 790 | 111 | items (membership): −0/+3; item × language: −0/+4; partners: −2/+11 |
| weights-measures | 136 | 19 | 86 | 13 | ✓ |
| with-brush-and-qalam | 41 | 1 | 9 | 1 | ✓ |
| woodwork | 1470 | 149 | 819 | 112 | items (membership): −0/+3; item × language: −0/+3; partners: −0/+1 |
