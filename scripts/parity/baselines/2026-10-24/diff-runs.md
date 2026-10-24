# Parity run vs baseline

- **baseline:** /var/www/app/scripts/parity/tools/../baselines/2026-10-22b
- **run:** /parity/out
- **real differences (overview):** 3348 → 1342

## Gate

**FAILED** — 1 regressions:

| Site | What | Baseline | Run |
|---|---|---|---|
| baroqueart | field detail.heading | 22 | 24 |

## Open package defects

Known in the baseline, so not regressions, but each one is still a place where the site can differ from legacy. Details per URL and text are in `packages.md`. When a count falls, take a new baseline to lock it in.

| Site | Check | Baseline | Run |
|---|---|---|---|
| amulets | image URLs not /pub/<uuid> | 5 | 0 ↓ |
| archaeology | image URLs not /pub/<uuid> | 6 | 1 ↓ |
| architectural-elements | image URLs not /pub/<uuid> | 8 | 0 ↓ |
| arms-armoury | image URLs not /pub/<uuid> | 1 | 1 |
| arts-in-dialogue | image URLs not /pub/<uuid> | 2 | 2 |
| baroqueart | image URLs not /pub/<uuid> | 280 | 280 |
| calligraphy | image URLs not /pub/<uuid> | 19 | 7 ↓ |
| carpets | image URLs not /pub/<uuid> | 2 | 2 |
| ceramics | image URLs not /pub/<uuid> | 6 | 3 ↓ |
| clothing | image URLs not /pub/<uuid> | 17 | 1 ↓ |
| coins-medals | image URLs not /pub/<uuid> | 28 | 1 ↓ |
| coins-medals | texts with raw HTML | 1 | 1 |
| communication | image URLs not /pub/<uuid> | 27 | 1 ↓ |
| explore | image URLs not /pub/<uuid> | 45 | 38 ↓ |
| explore | texts with raw HTML | 12 | 12 |
| funerary-objects | image URLs not /pub/<uuid> | 1 | 1 |
| glass | image URLs not /pub/<uuid> | 1 | 1 |
| gold-silver | image URLs not /pub/<uuid> | 20 | 4 ↓ |
| islamicart | image URLs not /pub/<uuid> | 28 | 28 |
| jewellery | image URLs not /pub/<uuid> | 7 | 1 ↓ |
| landscapes | image URLs not /pub/<uuid> | 70 | 3 ↓ |
| leatherworks | image URLs not /pub/<uuid> | 7 | 4 ↓ |
| manuscripts | image URLs not /pub/<uuid> | 59 | 3 ↓ |
| metalwork | image URLs not /pub/<uuid> | 5 | 2 ↓ |
| paintings | image URLs not /pub/<uuid> | 29 | 4 ↓ |
| photographs | image URLs not /pub/<uuid> | 163 | 9 ↓ |
| photographs | texts with raw HTML | 1 | 1 |
| porcelain | image URLs not /pub/<uuid> | 2 | 2 |
| portraits | image URLs not /pub/<uuid> | 4 | 1 ↓ |
| precious-stones | image URLs not /pub/<uuid> | 1 | 1 |
| prints-drawings | image URLs not /pub/<uuid> | 42 | 1 ↓ |
| religious-life | image URLs not /pub/<uuid> | 16 | 5 ↓ |
| scientific-objects | image URLs not /pub/<uuid> | 8 | 0 ↓ |
| sculptures | image URLs not /pub/<uuid> | 11 | 3 ↓ |
| sharinghistory | image URLs not /pub/<uuid> | 4 | 4 |
| sharinghistory | texts with raw HTML | 10 | 10 |
| textiles | image URLs not /pub/<uuid> | 17 | 2 ↓ |
| the-hijaz-railway | image URLs not /pub/<uuid> | 465 | 10 ↓ |
| the-table-is-set | image URLs not /pub/<uuid> | 2 | 2 |
| the-use-of-colours-in-art | image URLs not /pub/<uuid> | 2 | 2 |
| theatre | image URLs not /pub/<uuid> | 1 | 1 |
| toys-games | image URLs not /pub/<uuid> | 1 | 1 |
| wallpaintings | image URLs not /pub/<uuid> | 1 | 1 |
| water-in-islam | image URLs not /pub/<uuid> | 32 | 11 ↓ |
| woodwork | image URLs not /pub/<uuid> | 12 | 2 ↓ |

## Fields (real differences = different / missing / extra, summed over the sites of this run)

| Field | Before | After | Δ | Format-only before → after | Compared after | Sites still off |
|---|---|---|---|---|---|---|
| item.copy_editor | 775 | 9 | -766 | 7246 → 7246 | 29619 | 3 |
| package.image URL is /pub/<uuid> | 699 | 153 | -546 | 0 → 0 | 47822 | 37 |
| item.author | 572 | 73 | -499 | 8508 → 8752 | 29619 | 11 |
| item.bibliography | 392 | 55 | -337 | 72 → 22 | 25136 | 18 |
| item.translation_copy_editor | 1265 | 1011 | -254 | 4070 → 4070 | 29619 | 4 |
| detail.description | 177 | 17 | -160 | 20 → 0 | 1628 | 1 |
| detail.artist | 109 | 21 | -88 | 0 → 0 | 1562 | 1 |
| item.description | 84 | 45 | -39 | 332 → 226 | 29089 | 8 |
| item.short_description | 49 | 10 | -39 | 51 → 0 | 23885 | 7 |
| detail.dates | 17 | 6 | -11 | 0 → 0 | 1628 | 1 |
| partner.description | 10 | 0 | -10 | 72 → 0 | 4675 | 0 |
| item.method_for_datation | 12 | 4 | -8 | 25 → 0 | 24871 | 3 |
| item.method_for_provenance | 4 | 0 | -4 | 3 → 0 | 21545 | 0 |
| item.history | 7 | 4 | -3 | 240 → 228 | 1259 | 1 |
| detail.location | 6 | 4 | -2 | 0 → 0 | 1628 | 1 |
| item.obtention | 2 | 0 | -2 | 18 → 0 | 22799 | 0 |
| country.description | 1 | 1 | 0 | 0 → 0 | 25 | 1 |
| country.name | 4 | 4 | 0 | 0 → 0 | 169 | 1 |
| event.date text.en | 84 | 84 | 0 | 0 → 0 | 58380 | 42 |
| exhibition.related content | 1 | 1 | 0 | 0 → 0 | 5 | 1 |
| item.alternate_name | 8 | 8 | 0 | 273 → 269 | 19214 | 3 |
| item.architects | 0 | 0 | 0 | 100 → 0 | 1333 | 0 |
| item.artist | 105 | 105 | 0 | 69 → 67 | 10686 | 11 |
| item.artist_birthdate | 3 | 3 | 0 | 0 → 0 | 3 | 1 |
| item.artist_birthplace | 1 | 1 | 0 | 0 → 0 | 1 | 1 |
| item.artist_deathdate | 2 | 2 | 0 | 0 → 0 | 2 | 1 |
| item.artist_deathplace | 1 | 1 | 0 | 0 → 0 | 1 | 1 |
| item.country_id_present_days | 22 | 22 | 0 | 0 → 0 | 22 | 1 |
| item.datation_method | 2 | 2 | 0 | 0 → 0 | 2 | 1 |
| item.dates | 7 | 7 | 0 | 3259 → 3259 | 29296 | 5 |
| item.dimensions | 5 | 5 | 0 | 3823 → 3742 | 24479 | 2 |
| item.dynasty (free text) | 7 | 7 | 0 | 1527 → 1527 | 25107 | 5 |
| item.holder | 26 | 26 | 0 | 2371 → 2371 | 27006 | 5 |
| item.image.count | 57 | 57 | 0 | 0 → 0 | 14849 | 10 |
| item.image.photographer | 3 | 3 | 0 | 0 → 0 | 17718 | 1 |
| item.initial_owner | 0 | 0 | 0 | 891 → 891 | 18677 | 0 |
| item.keywords | 1 | 1 | 0 | 0 → 0 | 17718 | 1 |
| item.location | 124 | 124 | 0 | 11560 → 11560 | 29617 | 24 |
| item.materials | 0 | 0 | 0 | 17 → 0 | 25040 | 0 |
| item.media | 33 | 33 | 0 | 0 → 0 | 9173 | 18 |
| item.mwnf_reference | 5 | 5 | 0 | 0 → 0 | 12427 | 3 |
| item.name | 0 | 0 | 0 | 4979 → 4863 | 29615 | 0 |
| item.other galleries | 77 | 77 | 0 | 0 → 0 | 9173 | 15 |
| item.owner | 0 | 0 | 0 | 316 → 316 | 18143 | 0 |
| item.owner_reference | 53 | 53 | 0 | 68 → 68 | 12641 | 18 |
| item.patrons | 2 | 2 | 0 | 4 → 0 | 2010 | 2 |
| item.provenance | 3 | 3 | 0 | 6 → 0 | 24699 | 3 |
| item.start/end | 53 | 53 | 0 | 0 → 0 | 9173 | 9 |
| item.translator | 39 | 39 | 0 | 4945 → 4945 | 29619 | 2 |
| item.type | 6 | 6 | 0 | 1 → 0 | 20931 | 6 |
| location.how_to_reach | 0 | 0 | 0 | 2 → 0 | 22 | 0 |
| location.info | 0 | 0 | 0 | 5 → 0 | 11 | 0 |
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
| record.package language | 4 | 4 | 0 | 0 → 0 | 4 | 1 |
| site.banner item | 1 | 1 | 0 | 0 → 0 | 42 | 1 |
| site.hidden | 1 | 1 | 0 | 0 → 0 | 42 | 1 |
| sub-itinerary.monuments | 1 | 1 | 0 | 0 → 0 | 109 | 1 |
| territory.description | 2 | 2 | 0 | 0 → 0 | 50 | 1 |
| territory.name | 2 | 2 | 0 | 0 → 0 | 50 | 1 |
| theme.contextual descriptions (count) | 2 | 2 | 0 | 0 → 0 | 2 | 2 |
| theme.picture count | 25 | 25 | 0 | 0 → 0 | 129 | 2 |
| theme.presentation | 14 | 14 | 0 | 0 → 0 | 129 | 2 |
| theme.quote | 16 | 16 | 0 | 0 → 0 | 129 | 1 |
| theme.title | 11 | 11 | 0 | 0 → 0 | 129 | 2 |
| detail.heading | 22 | 24 | +2 | 0 → 0 | 24 | 1 |

## Sites

| Site | Real before | Real after | Unexplained before | after | Record sets off (after) |
|---|---|---|---|---|---|
| amulets | 7 | 2 | 6 | 1 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+1 |
| archaeology | 30 | 15 | 30 | 15 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+1 |
| architectural-elements | 27 | 5 | 27 | 5 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+2 |
| arms-armoury | 7 | 3 | 7 | 3 | ✓ |
| arts-in-dialogue | 15 | 12 | 15 | 11 | items (membership): −1/+3; item × language: −0/+22; partners: −1/+5; timeline events (country|year|text, en): −0/+4 |
| baroqueart | 576 | 220 | 548 | 192 | exhibitions: −1/+0; exhibition_themes: −3/+0; partners referenced by records: −4/+12 |
| calligraphy | 121 | 54 | 119 | 52 | items (membership): −0/+3; item × language: −2/+3; partners: −0/+3 |
| carpets | 6 | 6 | 5 | 5 | ✓ |
| ceramics | 63 | 30 | 61 | 28 | items (membership): −0/+2; item × language: −1/+2; partners: −0/+1 |
| clothing | 38 | 12 | 38 | 12 | items (membership): −0/+7; item × language: −0/+7; partners: −0/+2 |
| coins-medals | 51 | 4 | 51 | 4 | items (membership): −0/+9; item × language: −0/+9; partners: −0/+4 |
| communication | 37 | 2 | 37 | 2 | items (membership): −0/+17; item × language: −0/+17; partners: −0/+8 |
| explore | 64 | 57 | 64 | 57 | ✓ |
| funerary-objects | 8 | 3 | 8 | 3 | ✓ |
| galleries | 0 | 0 | 0 | 0 | ✓ |
| glass | 16 | 12 | 16 | 12 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+2 |
| gold-silver | 30 | 8 | 30 | 8 | items (membership): −0/+5; item × language: −1/+5; partners: −0/+2 |
| historical-cars | 3 | 1 | 3 | 1 | ✓ |
| islamicart | 821 | 449 | 803 | 430 | record × language (dump vs package): −4/+16; partners referenced by records: −10/+1 |
| ivory | 7 | 3 | 7 | 3 | ✓ |
| jewellery | 29 | 5 | 28 | 4 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+1 |
| landscapes | 76 | 4 | 76 | 4 | items (membership): −0/+13; item × language: −0/+13; partners: −0/+5 |
| leatherworks | 9 | 6 | 8 | 5 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+1 |
| manuscripts | 100 | 25 | 99 | 24 | items (membership): −0/+8; item × language: −1/+8; partners: −0/+4 |
| metalwork | 44 | 18 | 44 | 18 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+1 |
| mosaics | 7 | 3 | 7 | 3 | ✓ |
| musical-instruments | 0 | 0 | 0 | 0 | ✓ |
| paintings | 87 | 34 | 85 | 32 | items (membership): −0/+18; item × language: −0/+18; partners: −0/+7 |
| photographs | 226 | 37 | 226 | 37 | items (membership): −0/+100; item × language: −0/+100; partners: −0/+11; countries (items ∪ timeline ∪ partners): −0/+1 |
| porcelain | 3 | 3 | 3 | 3 | ✓ |
| portraits | 44 | 12 | 44 | 12 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+2 |
| precious-stones | 11 | 5 | 11 | 5 | ✓ |
| prints-drawings | 144 | 54 | 142 | 52 | items (membership): −0/+29; item × language: −0/+29; partners: −0/+7 |
| religious-life | 36 | 20 | 35 | 19 | items (membership): −0/+5; item × language: −0/+5; partners: −0/+2 |
| scientific-objects | 19 | 6 | 18 | 5 | items (membership): −0/+3; item × language: −0/+3; partners: −0/+2 |
| sculptures | 18 | 7 | 16 | 5 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+2 |
| sharinghistory | 311 | 54 | 311 | 54 | record × language (dump vs package): −1/+0; partners referenced by records: −0/+15 |
| textiles | 27 | 12 | 27 | 12 | items (membership): −0/+9; item × language: −0/+9; partners: −0/+2 |
| the-hijaz-railway | — | — | — | — | ✓ |
| the-table-is-set | 44 | 29 | 43 | 28 | items (membership): −0/+2; item × language: −2/+13; partners: −1/+0 |
| the-use-of-colours-in-art | 48 | 34 | 46 | 32 | items (membership): −1/+1; item × language: −0/+6; partners: −2/+1; timeline events (country|year|text, en): −0/+45 |
| theatre | 7 | 7 | 7 | 7 | ✓ |
| toys-games | 2 | 1 | 2 | 1 | ✓ |
| wallpaintings | 6 | 4 | 6 | 4 | ✓ |
| water-in-islam | 63 | 37 | 61 | 35 | items (membership): −0/+3; item × language: −0/+4; partners: −2/+11 |
| weights-measures | 2 | 2 | 2 | 2 | ✓ |
| with-brush-and-qalam | 1 | 1 | 1 | 1 | ✓ |
| woodwork | 57 | 24 | 57 | 24 | items (membership): −0/+3; item × language: −0/+3; partners: −0/+1 |
