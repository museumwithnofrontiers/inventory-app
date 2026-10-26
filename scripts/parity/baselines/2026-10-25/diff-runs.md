# Parity run vs baseline

- **baseline:** /var/www/app/scripts/parity/tools/../baselines/2026-10-24
- **run:** /parity/out
- **real differences (overview):** 1342 → 287

## Gate

**FAILED** — 1 regressions:

| Site | What | Baseline | Run |
|---|---|---|---|
| the-hijaz-railway | field theme.presentation | 3 | 4 |

## Open package defects

Known in the baseline, so not regressions, but each one is still a place where the site can differ from legacy. Details per URL and text are in `packages.md`. When a count falls, take a new baseline to lock it in.

| Site | Check | Baseline | Run |
|---|---|---|---|
| archaeology | image URLs not /pub/<uuid> | 1 | 1 |
| arms-armoury | image URLs not /pub/<uuid> | 1 | 1 |
| arts-in-dialogue | image URLs not /pub/<uuid> | 2 | 2 |
| baroqueart | image URLs not /pub/<uuid> | 280 | 280 |
| calligraphy | image URLs not /pub/<uuid> | 7 | 7 |
| carpets | image URLs not /pub/<uuid> | 2 | 2 |
| ceramics | image URLs not /pub/<uuid> | 3 | 3 |
| clothing | image URLs not /pub/<uuid> | 1 | 1 |
| coins-medals | image URLs not /pub/<uuid> | 1 | 1 |
| coins-medals | texts with raw HTML | 1 | 1 |
| communication | image URLs not /pub/<uuid> | 1 | 1 |
| explore | image URLs not /pub/<uuid> | 38 | 38 |
| explore | texts with raw HTML | 12 | 12 |
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
| photographs | texts with raw HTML | 1 | 1 |
| porcelain | image URLs not /pub/<uuid> | 2 | 2 |
| portraits | image URLs not /pub/<uuid> | 1 | 1 |
| precious-stones | image URLs not /pub/<uuid> | 1 | 1 |
| prints-drawings | image URLs not /pub/<uuid> | 1 | 1 |
| religious-life | image URLs not /pub/<uuid> | 5 | 5 |
| sculptures | image URLs not /pub/<uuid> | 3 | 3 |
| sharinghistory | image URLs not /pub/<uuid> | 4 | 4 |
| sharinghistory | texts with raw HTML | 10 | 10 |
| textiles | image URLs not /pub/<uuid> | 2 | 2 |
| the-hijaz-railway | image URLs not /pub/<uuid> | 10 | 10 |
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
| package.item partner_id resolves | 497 | 0 | -497 | 0 → 0 | 14474 | 0 |
| package.image URL is /pub/<uuid> | 153 | 0 | -153 | 0 → 0 | 47822 | 0 |
| item.artist | 105 | 2 | -103 | 67 → 44 | 19722 | 2 |
| item.location | 124 | 29 | -95 | 11560 → 11560 | 29617 | 6 |
| item.other galleries | 77 | 0 | -77 | 0 → 0 | 9173 | 0 |
| item.start/end | 53 | 1 | -52 | 0 → 0 | 9173 | 1 |
| item.owner_reference | 53 | 6 | -47 | 68 → 68 | 12641 | 3 |
| item.media | 33 | 0 | -33 | 0 → 0 | 17718 | 0 |
| detail.heading | 24 | 0 | -24 | 0 → 0 | 0 | 0 |
| detail.artist | 21 | 0 | -21 | 0 → 0 | 1557 | 0 |
| item.bibliography | 55 | 36 | -19 | 22 → 22 | 25136 | 14 |
| detail.description | 17 | 1 | -16 | 0 → 0 | 1628 | 1 |
| location.name | 14 | 0 | -14 | 1 → 0 | 649 | 0 |
| item.description | 45 | 35 | -10 | 226 → 226 | 29089 | 4 |
| item.image.count | 57 | 49 | -8 | 0 → 0 | 14849 | 3 |
| detail.dates | 6 | 0 | -6 | 0 → 0 | 1628 | 0 |
| item.mwnf_reference | 5 | 0 | -5 | 0 → 0 | 14849 | 0 |
| detail.location | 4 | 0 | -4 | 0 → 0 | 1628 | 0 |
| country.description | 1 | 1 | 0 | 0 → 0 | 25 | 1 |
| country.name | 4 | 4 | 0 | 0 → 0 | 169 | 1 |
| event.date text.en | 84 | 84 | 0 | 0 → 0 | 58380 | 42 |
| exhibition.related content | 1 | 1 | 0 | 0 → 0 | 5 | 1 |
| item.alternate_name | 8 | 8 | 0 | 269 → 269 | 19214 | 3 |
| item.artist_birthdate | 3 | 3 | 0 | 0 → 0 | 3 | 1 |
| item.artist_birthplace | 1 | 1 | 0 | 0 → 0 | 1 | 1 |
| item.artist_deathdate | 2 | 2 | 0 | 0 → 0 | 2 | 1 |
| item.artist_deathplace | 1 | 1 | 0 | 0 → 0 | 1 | 1 |
| item.author | 73 | 73 | 0 | 8752 → 8752 | 29619 | 11 |
| item.copy_editor | 9 | 9 | 0 | 7246 → 7246 | 29619 | 3 |
| item.country_id_present_days | 22 | 22 | 0 | 0 → 0 | 22 | 1 |
| item.datation_method | 2 | 2 | 0 | 0 → 0 | 2 | 1 |
| item.dates | 7 | 7 | 0 | 3259 → 3259 | 29296 | 5 |
| item.dimensions | 5 | 5 | 0 | 3742 → 3742 | 24479 | 2 |
| item.dynasty (free text) | 7 | 7 | 0 | 1527 → 1527 | 25107 | 5 |
| item.history | 4 | 4 | 0 | 228 → 228 | 1259 | 1 |
| item.holder | 26 | 26 | 0 | 2371 → 2371 | 27006 | 5 |
| item.image.photographer | 3 | 3 | 0 | 0 → 0 | 17718 | 1 |
| item.initial_owner | 0 | 0 | 0 | 891 → 891 | 18677 | 0 |
| item.keywords | 1 | 1 | 0 | 0 → 0 | 17718 | 1 |
| item.method_for_datation | 4 | 4 | 0 | 0 → 0 | 24871 | 3 |
| item.name | 0 | 0 | 0 | 4863 → 4863 | 29615 | 0 |
| item.owner | 0 | 0 | 0 | 316 → 316 | 18143 | 0 |
| item.patrons | 2 | 2 | 0 | 0 → 0 | 2010 | 2 |
| item.provenance | 3 | 3 | 0 | 0 → 0 | 24699 | 3 |
| item.short_description | 10 | 10 | 0 | 0 → 0 | 23885 | 7 |
| item.translation_copy_editor | 1011 | 1011 | 0 | 4070 → 4070 | 29619 | 4 |
| item.translator | 39 | 39 | 0 | 4945 → 4945 | 29619 | 2 |
| item.type | 6 | 6 | 0 | 0 → 0 | 20931 | 6 |
| membership.sh_exhibition_subthemes (assigned ∪ slideshow items) | 1 | 1 | 0 | 0 → 0 | 140 | 1 |
| membership.sh_exhibition_subthemes (assigned items) | 14 | 14 | 0 | 0 → 0 | 140 | 1 |
| membership.sh_exhibition_themes (assigned items) | 6 | 6 | 0 | 0 → 0 | 42 | 1 |
| membership.sh_exhibitions (assigned items) | 1 | 1 | 0 | 0 → 0 | 10 | 1 |
| membership.Travels monuments (count only) | 2 | 2 | 0 | 0 → 0 | 2 | 2 |
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
| theme.quote | 16 | 16 | 0 | 0 → 0 | 129 | 1 |
| theme.title | 11 | 11 | 0 | 0 → 0 | 129 | 2 |
| theme.presentation | 14 | 15 | +1 | 0 → 0 | 129 | 2 |

## Sites

| Site | Real before | Real after | Unexplained before | after | Record sets off (after) |
|---|---|---|---|---|---|
| amulets | 2 | 1 | 1 | 1 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+1 |
| archaeology | 15 | 4 | 15 | 4 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+1 |
| architectural-elements | 5 | 1 | 5 | 1 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+2 |
| arms-armoury | 3 | 1 | 3 | 1 | ✓ |
| arts-in-dialogue | 12 | 7 | 11 | 7 | items (membership): −1/+3; item × language: −0/+22; partners: −1/+5; timeline events (country|year|text, en): −0/+4 |
| baroqueart | 220 | 12 | 192 | 8 | exhibitions: −1/+0; exhibition_themes: −3/+0; partners referenced by records: −4/+12 |
| calligraphy | 54 | 17 | 52 | 16 | items (membership): −0/+3; item × language: −2/+3; partners: −0/+3 |
| carpets | 6 | 3 | 5 | 2 | ✓ |
| ceramics | 30 | 12 | 28 | 10 | items (membership): −0/+2; item × language: −1/+2; partners: −0/+1 |
| clothing | 12 | 5 | 12 | 5 | items (membership): −0/+7; item × language: −0/+7; partners: −0/+2 |
| coins-medals | 4 | 3 | 4 | 3 | items (membership): −0/+9; item × language: −0/+9; partners: −0/+4 |
| communication | 2 | 1 | 2 | 1 | items (membership): −0/+17; item × language: −0/+17; partners: −0/+8 |
| explore | 57 | 9 | 57 | 9 | ✓ |
| funerary-objects | 3 | 2 | 3 | 2 | ✓ |
| galleries | 0 | 0 | 0 | 0 | ✓ |
| glass | 12 | 2 | 12 | 2 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+2 |
| gold-silver | 8 | 3 | 8 | 3 | items (membership): −0/+5; item × language: −1/+5; partners: −0/+2 |
| historical-cars | 1 | 0 | 1 | 0 | ✓ |
| islamicart | 449 | 60 | 430 | 48 | record × language (dump vs package): −4/+16; partners referenced by records: −10/+1 |
| ivory | 3 | 1 | 3 | 1 | ✓ |
| jewellery | 5 | 2 | 4 | 2 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+1 |
| landscapes | 4 | 1 | 4 | 1 | items (membership): −0/+13; item × language: −0/+13; partners: −0/+5 |
| leatherworks | 6 | 2 | 5 | 1 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+1 |
| manuscripts | 25 | 8 | 24 | 8 | items (membership): −0/+8; item × language: −1/+8; partners: −0/+4 |
| metalwork | 18 | 6 | 18 | 6 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+1 |
| mosaics | 3 | 1 | 3 | 1 | ✓ |
| musical-instruments | 0 | 0 | 0 | 0 | ✓ |
| paintings | 34 | 3 | 32 | 3 | items (membership): −0/+18; item × language: −0/+18; partners: −0/+7 |
| photographs | 37 | 5 | 37 | 5 | items (membership): −0/+100; item × language: −0/+100; partners: −0/+11; countries (items ∪ timeline ∪ partners): −0/+1 |
| porcelain | 3 | 1 | 3 | 1 | ✓ |
| portraits | 12 | 3 | 12 | 3 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+2 |
| precious-stones | 5 | 3 | 5 | 3 | ✓ |
| prints-drawings | 54 | 12 | 52 | 10 | items (membership): −0/+29; item × language: −0/+29; partners: −0/+7 |
| religious-life | 20 | 4 | 19 | 3 | items (membership): −0/+5; item × language: −0/+5; partners: −0/+2 |
| scientific-objects | 6 | 5 | 5 | 4 | items (membership): −0/+3; item × language: −0/+3; partners: −0/+2 |
| sculptures | 7 | 3 | 5 | 2 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+2 |
| sharinghistory | 54 | 40 | 54 | 40 | record × language (dump vs package): −1/+0; partners referenced by records: −0/+15 |
| textiles | 12 | 0 | 12 | 0 | items (membership): −0/+9; item × language: −0/+9; partners: −0/+2 |
| the-hijaz-railway | — | — | — | — | ✓ |
| the-table-is-set | 29 | 21 | 28 | 21 | items (membership): −0/+2; item × language: −2/+13; partners: −1/+0 |
| the-use-of-colours-in-art | 34 | 2 | 32 | 2 | items (membership): −1/+1; item × language: −0/+6; partners: −2/+1; timeline events (country|year|text, en): −0/+45 |
| theatre | 7 | 0 | 7 | 0 | ✓ |
| toys-games | 1 | 0 | 1 | 0 | ✓ |
| wallpaintings | 4 | 3 | 4 | 3 | ✓ |
| water-in-islam | 37 | 10 | 35 | 10 | items (membership): −0/+3; item × language: −0/+4; partners: −2/+11 |
| weights-measures | 2 | 0 | 2 | 0 | ✓ |
| with-brush-and-qalam | 1 | 0 | 1 | 0 | ✓ |
| woodwork | 24 | 8 | 24 | 8 | items (membership): −0/+3; item × language: −0/+3; partners: −0/+1 |
