# Parity run vs baseline

- **baseline:** /var/www/app/scripts/parity/tools/../baselines/2026-10-19
- **run:** /parity/out
- **real differences (overview):** 9144 → 4128

## Gate

**FAILED** — 2 regressions:

| Site | What | Baseline | Run |
|---|---|---|---|
| arts-in-dialogue | field site.hidden | 0 | 1 |
| baroqueart | field item.artist | 217 | 229 |

## Open package defects

Known in the baseline, so not regressions, but each one is still a place where the site can differ from legacy. Details per URL and text are in `packages.md`. When a count falls, take a new baseline to lock it in.

| Site | Check | Baseline | Run |
|---|---|---|---|
| amulets | image URLs not /pub/<uuid> | 5 | 5 |
| archaeology | image URLs not /pub/<uuid> | 6 | 6 |
| architectural-elements | image URLs not /pub/<uuid> | 8 | 8 |
| architectural-elements | texts with raw HTML | 2 | 0 ↓ |
| arms-armoury | image URLs not /pub/<uuid> | 1 | 1 |
| arts-in-dialogue | image URLs not /pub/<uuid> | 2 | 2 |
| baroqueart | image URLs not /pub/<uuid> | 280 | 280 |
| calligraphy | image URLs not /pub/<uuid> | 19 | 19 |
| calligraphy | texts with raw HTML | 15 | 0 ↓ |
| carpets | image URLs not /pub/<uuid> | 2 | 2 |
| ceramics | image URLs not /pub/<uuid> | 6 | 6 |
| ceramics | texts with raw HTML | 18 | 0 ↓ |
| clothing | image URLs not /pub/<uuid> | 17 | 17 |
| coins-medals | image URLs not /pub/<uuid> | 28 | 28 |
| coins-medals | texts with raw HTML | 1 | 1 |
| communication | image URLs not /pub/<uuid> | 27 | 27 |
| explore | image URLs not /pub/<uuid> | 45 | 45 |
| explore | texts with raw HTML | 14 | 12 ↓ |
| funerary-objects | image URLs not /pub/<uuid> | 1 | 1 |
| funerary-objects | texts with raw HTML | 5 | 0 ↓ |
| glass | image URLs not /pub/<uuid> | 1 | 1 |
| glass | texts with raw HTML | 2 | 0 ↓ |
| gold-silver | image URLs not /pub/<uuid> | 20 | 20 |
| islamicart | image URLs not /pub/<uuid> | 28 | 28 |
| islamicart | texts with raw HTML | 34 | 0 ↓ |
| ivory | texts with raw HTML | 2 | 0 ↓ |
| jewellery | image URLs not /pub/<uuid> | 7 | 7 |
| landscapes | image URLs not /pub/<uuid> | 70 | 70 |
| leatherworks | image URLs not /pub/<uuid> | 7 | 7 |
| manuscripts | image URLs not /pub/<uuid> | 59 | 59 |
| manuscripts | texts with raw HTML | 1 | 0 ↓ |
| metalwork | image URLs not /pub/<uuid> | 5 | 5 |
| metalwork | texts with raw HTML | 1 | 0 ↓ |
| paintings | image URLs not /pub/<uuid> | 29 | 29 |
| photographs | image URLs not /pub/<uuid> | 163 | 163 |
| photographs | texts with raw HTML | 1 | 1 |
| porcelain | image URLs not /pub/<uuid> | 2 | 2 |
| portraits | image URLs not /pub/<uuid> | 4 | 4 |
| precious-stones | image URLs not /pub/<uuid> | 1 | 1 |
| prints-drawings | image URLs not /pub/<uuid> | 42 | 42 |
| religious-life | image URLs not /pub/<uuid> | 16 | 16 |
| religious-life | texts with raw HTML | 2 | 0 ↓ |
| scientific-objects | image URLs not /pub/<uuid> | 8 | 8 |
| sculptures | image URLs not /pub/<uuid> | 11 | 11 |
| sharinghistory | image URLs not /pub/<uuid> | 4 | 4 |
| sharinghistory | texts with raw HTML | 10 | 10 |
| textiles | image URLs not /pub/<uuid> | 17 | 17 |
| textiles | texts with raw HTML | 2 | 0 ↓ |
| the-hijaz-railway | image URLs not /pub/<uuid> | 461 | 461 |
| the-table-is-set | image URLs not /pub/<uuid> | 2 | 2 |
| the-table-is-set | texts with raw HTML | 2 | 0 ↓ |
| the-use-of-colours-in-art | image URLs not /pub/<uuid> | 2 | 2 |
| theatre | image URLs not /pub/<uuid> | 1 | 1 |
| toys-games | image URLs not /pub/<uuid> | 1 | 1 |
| wallpaintings | image URLs not /pub/<uuid> | 1 | 1 |
| water-in-islam | image URLs not /pub/<uuid> | 32 | 32 |
| water-in-islam | texts with raw HTML | 2 | 0 ↓ |
| weights-measures | texts with raw HTML | 2 | 0 ↓ |
| woodwork | image URLs not /pub/<uuid> | 12 | 12 |
| woodwork | texts with raw HTML | 3 | 0 ↓ |

## Fields (real differences = different / missing / extra, summed over the sites of this run)

| Field | Before | After | Δ | Format-only before → after | Compared after | Sites still off |
|---|---|---|---|---|---|---|
| item.materials | 2256 | 0 | -2256 | 2063 → 17 | 25040 | 0 |
| item.artist | 1303 | 319 | -984 | 38 → 58 | 10686 | 11 |
| item.keywords | 637 | 2 | -635 | 9277 → 0 | 17718 | 2 |
| item.copy_editor | 1528 | 954 | -574 | 7246 → 7246 | 29619 | 23 |
| item.author | 2633 | 2078 | -555 | 8508 → 8508 | 29619 | 41 |
| item.bibliography | 571 | 478 | -93 | 72 → 72 | 25136 | 34 |
| item.other galleries | 90 | 77 | -13 | 0 → 0 | 9173 | 15 |
| item.translator | 178 | 172 | -6 | 4945 → 4945 | 29619 | 2 |
| country.description | 1 | 1 | 0 | 0 → 0 | 25 | 1 |
| country.name | 4 | 4 | 0 | 0 → 0 | 169 | 1 |
| detail.artist | 109 | 109 | 0 | 0 → 0 | 1522 | 1 |
| detail.dates | 17 | 17 | 0 | 0 → 0 | 1624 | 1 |
| detail.description | 177 | 177 | 0 | 20 → 20 | 1624 | 1 |
| detail.heading | 22 | 22 | 0 | 0 → 0 | 22 | 1 |
| detail.location | 6 | 6 | 0 | 0 → 0 | 1624 | 1 |
| event.date text.en | 84 | 84 | 0 | 0 → 0 | 58380 | 42 |
| exhibition.related content | 1 | 1 | 0 | 0 → 0 | 5 | 1 |
| item.alternate_name | 8 | 8 | 0 | 273 → 273 | 19214 | 3 |
| item.architects | 0 | 0 | 0 | 100 → 100 | 1333 | 0 |
| item.artist_birthdate | 3 | 3 | 0 | 0 → 0 | 3 | 1 |
| item.artist_birthplace | 1 | 1 | 0 | 0 → 0 | 1 | 1 |
| item.artist_deathdate | 2 | 2 | 0 | 0 → 0 | 2 | 1 |
| item.artist_deathplace | 1 | 1 | 0 | 0 → 0 | 1 | 1 |
| item.country_id_present_days | 22 | 22 | 0 | 0 → 0 | 22 | 1 |
| item.datation_method | 2 | 2 | 0 | 0 → 0 | 2 | 1 |
| item.dates | 7 | 7 | 0 | 3259 → 3259 | 29296 | 5 |
| item.description | 112 | 112 | 0 | 332 → 332 | 29089 | 16 |
| item.dimensions | 5 | 5 | 0 | 3823 → 3823 | 24479 | 2 |
| item.dynasties | 702 | 702 | 0 | 0 → 0 | 17718 | 36 |
| item.dynasty (free text) | 7 | 7 | 0 | 1527 → 1527 | 25107 | 5 |
| item.dynasty line → a linked dynasty exists | 260 | 260 | 0 | 7129 → 7129 | 7389 | 2 |
| item.history | 7 | 7 | 0 | 240 → 240 | 1259 | 3 |
| item.holder | 29 | 29 | 0 | 2370 → 2370 | 27006 | 7 |
| item.image.copyright | 3195 | 3195 | 0 | 0 → 0 | 14663 | 40 |
| item.image.count | 57 | 57 | 0 | 0 → 0 | 14849 | 10 |
| item.image.photographer | 212 | 212 | 0 | 0 → 0 | 14663 | 26 |
| item.initial_owner | 0 | 0 | 0 | 891 → 891 | 18677 | 0 |
| item.location | 124 | 124 | 0 | 11560 → 11560 | 29617 | 24 |
| item.materials (in tags) | 0 | 0 | 0 | 502 → 0 | 0 | 0 |
| item.media | 33 | 33 | 0 | 0 → 0 | 9173 | 18 |
| item.method_for_datation | 12 | 12 | 0 | 25 → 25 | 24871 | 6 |
| item.method_for_provenance | 4 | 4 | 0 | 3 → 3 | 21545 | 3 |
| item.monument_contact | 38 | 38 | 0 | 0 → 0 | 38 | 1 |
| item.mwnf_reference | 5 | 5 | 0 | 0 → 0 | 12427 | 3 |
| item.name | 5 | 5 | 0 | 4978 → 4978 | 29615 | 5 |
| item.notice | 149 | 149 | 0 | 0 → 0 | 149 | 1 |
| item.notice_c | 197 | 197 | 0 | 0 → 0 | 197 | 1 |
| item.obtention | 2 | 2 | 0 | 18 → 18 | 22799 | 2 |
| item.owner | 0 | 0 | 0 | 316 → 316 | 18143 | 0 |
| item.owner_reference | 53 | 53 | 0 | 68 → 68 | 12641 | 18 |
| item.patrons | 2 | 2 | 0 | 4 → 4 | 2010 | 2 |
| item.provenance | 3 | 3 | 0 | 6 → 6 | 24699 | 3 |
| item.short_description | 53 | 53 | 0 | 51 → 51 | 23885 | 18 |
| item.start/end | 53 | 53 | 0 | 0 → 0 | 9173 | 9 |
| item.structured_bibliography | 98 | 98 | 0 | 0 → 0 | 98 | 1 |
| item.translation_copy_editor | 1470 | 1470 | 0 | 4070 → 4070 | 29619 | 28 |
| item.type | 6 | 6 | 0 | 1 → 1 | 20931 | 6 |
| location.how_to_reach | 0 | 0 | 0 | 2 → 2 | 22 | 0 |
| location.info | 0 | 0 | 0 | 5 → 5 | 11 | 0 |
| location.name | 14 | 14 | 0 | 1 → 1 | 649 | 1 |
| membership.sh_exhibition_subthemes (assigned ∪ slideshow items) | 1 | 1 | 0 | 0 → 0 | 140 | 1 |
| membership.sh_exhibition_subthemes (assigned items) | 14 | 14 | 0 | 0 → 0 | 140 | 1 |
| membership.sh_exhibition_themes (assigned items) | 6 | 6 | 0 | 0 → 0 | 42 | 1 |
| membership.sh_exhibitions (assigned items) | 1 | 1 | 0 | 0 → 0 | 10 | 1 |
| membership.Travels monuments (count only) | 2 | 2 | 0 | 0 → 0 | 2 | 2 |
| package.image URL is /pub/<uuid> | 699 | 699 | 0 | 0 → 0 | 47822 | 40 |
| package.item partner_id resolves | 497 | 497 | 0 | 0 → 0 | 14474 | 4 |
| partner.city | 9 | 9 | 0 | 0 → 0 | 4896 | 9 |
| partner.description | 38 | 38 | 0 | 72 → 72 | 4675 | 26 |
| partner.languages | 48 | 48 | 0 | 0 → 0 | 2091 | 31 |
| partner.name | 2 | 2 | 0 | 28 → 28 | 4917 | 2 |
| record.package language | 4 | 4 | 0 | 0 → 0 | 4 | 1 |
| site.banner item | 1 | 1 | 0 | 0 → 0 | 42 | 1 |
| sub-itinerary.monuments | 1 | 1 | 0 | 0 → 0 | 109 | 1 |
| territory.description | 2 | 2 | 0 | 0 → 0 | 50 | 1 |
| territory.name | 2 | 2 | 0 | 0 → 0 | 50 | 1 |
| theme.contextual descriptions (count) | 2 | 2 | 0 | 0 → 0 | 2 | 2 |
| theme.picture count | 25 | 25 | 0 | 0 → 0 | 129 | 2 |
| theme.presentation | 14 | 14 | 0 | 0 → 0 | 129 | 2 |
| theme.quote | 16 | 16 | 0 | 0 → 0 | 129 | 1 |
| theme.title | 11 | 11 | 0 | 0 → 0 | 129 | 2 |
| site.hidden | 0 | 1 | +1 | 0 → 0 | 42 | 1 |

## Sites

| Site | Real before | Real after | Unexplained before | after | Record sets off (after) |
|---|---|---|---|---|---|
| amulets | 20 | 8 | 12 | 6 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+1 |
| archaeology | 90 | 32 | 58 | 30 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+1 |
| architectural-elements | 90 | 28 | 66 | 27 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+2 |
| arms-armoury | 28 | 10 | 19 | 7 | ✓ |
| arts-in-dialogue | 25 | 19 | 24 | 19 | items (membership): −1/+3; item × language: −0/+22; partners: −1/+5; timeline events (country|year|text, en): −0/+4 |
| baroqueart | 816 | 828 | 599 | 629 | exhibitions: −1/+0; exhibition_themes: −3/+0; partners referenced by records: −4/+12 |
| calligraphy | 471 | 140 | 313 | 120 | items (membership): −0/+3; item × language: −2/+3; partners: −0/+3 |
| carpets | 49 | 13 | 27 | 5 | ✓ |
| ceramics | 343 | 67 | 181 | 62 | items (membership): −0/+2; item × language: −1/+2; partners: −0/+1 |
| clothing | 71 | 40 | 56 | 38 | items (membership): −0/+7; item × language: −0/+7; partners: −0/+2 |
| coins-medals | 74 | 51 | 68 | 51 | items (membership): −0/+9; item × language: −0/+9; partners: −0/+4 |
| communication | 55 | 37 | 55 | 37 | items (membership): −0/+17; item × language: −0/+17; partners: −0/+8 |
| explore | 64 | 64 | 64 | 64 | ✓ |
| funerary-objects | 64 | 8 | 47 | 8 | ✓ |
| galleries | 0 | 0 | 0 | 0 | ✓ |
| glass | 96 | 23 | 55 | 16 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+2 |
| gold-silver | 47 | 32 | 39 | 30 | items (membership): −0/+5; item × language: −1/+5; partners: −0/+2 |
| historical-cars | 8 | 3 | 8 | 3 | ✓ |
| islamicart | 3837 | 1204 | 3184 | 1030 | record × language (dump vs package): −4/+16; partners referenced by records: −10/+1 |
| ivory | 39 | 12 | 20 | 7 | ✓ |
| jewellery | 65 | 31 | 48 | 28 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+1 |
| landscapes | 116 | 76 | 112 | 76 | items (membership): −0/+13; item × language: −0/+13; partners: −0/+5 |
| leatherworks | 19 | 9 | 14 | 8 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+1 |
| manuscripts | 173 | 106 | 149 | 100 | items (membership): −0/+8; item × language: −1/+8; partners: −0/+4 |
| metalwork | 162 | 50 | 113 | 44 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+1 |
| mosaics | 11 | 8 | 8 | 7 | ✓ |
| musical-instruments | 3 | 0 | 3 | 0 | ✓ |
| paintings | 242 | 90 | 210 | 85 | items (membership): −0/+18; item × language: −0/+18; partners: −0/+7 |
| photographs | 371 | 226 | 371 | 226 | items (membership): −0/+100; item × language: −0/+100; partners: −0/+11; countries (items ∪ timeline ∪ partners): −0/+1 |
| porcelain | 5 | 3 | 5 | 3 | ✓ |
| portraits | 111 | 45 | 105 | 44 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+2 |
| precious-stones | 22 | 11 | 21 | 11 | ✓ |
| prints-drawings | 387 | 145 | 377 | 142 | items (membership): −0/+29; item × language: −0/+29; partners: −0/+7 |
| religious-life | 105 | 39 | 74 | 35 | items (membership): −0/+5; item × language: −0/+5; partners: −0/+2 |
| scientific-objects | 40 | 21 | 30 | 18 | items (membership): −0/+3; item × language: −0/+3; partners: −0/+2 |
| sculptures | 66 | 19 | 45 | 16 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+2 |
| sharinghistory | 312 | 312 | 311 | 311 | record × language (dump vs package): −1/+0; partners referenced by records: −0/+15 |
| textiles | 78 | 30 | 53 | 27 | items (membership): −0/+9; item × language: −0/+9; partners: −0/+2 |
| the-hijaz-railway | — | — | — | — | ✓ |
| the-table-is-set | 126 | 62 | 90 | 53 | items (membership): −0/+2; item × language: −2/+13; partners: −1/+0 |
| the-use-of-colours-in-art | 97 | 56 | 85 | 53 | items (membership): −1/+1; item × language: −0/+6; partners: −2/+1; timeline events (country|year|text, en): −0/+45 |
| theatre | 13 | 7 | 13 | 7 | ✓ |
| toys-games | 4 | 2 | 2 | 2 | ✓ |
| wallpaintings | 11 | 7 | 10 | 6 | ✓ |
| water-in-islam | 149 | 89 | 111 | 80 | items (membership): −0/+3; item × language: −0/+4; partners: −2/+11 |
| weights-measures | 19 | 2 | 13 | 2 | ✓ |
| with-brush-and-qalam | 1 | 1 | 1 | 1 | ✓ |
| woodwork | 149 | 62 | 112 | 57 | items (membership): −0/+3; item × language: −0/+3; partners: −0/+1 |
