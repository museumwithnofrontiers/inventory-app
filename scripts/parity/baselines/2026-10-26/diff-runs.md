# Parity run vs baseline

- **baseline:** /parity/runs/2026-10-25-curatorial-published
- **run:** /parity/out-r6
- **real differences (overview):** 287 → 49

## Gate

**FAILED** — 1 regressions:

| Site | What | Baseline | Run |
|---|---|---|---|
| the-hijaz-railway | set dump: items (dump membership, Travels excluded): only in the package | 262 | 263 |

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
| coins-medals | texts with raw HTML | 1 | 0 ↓ |
| communication | image URLs not /pub/<uuid> | 1 | 1 |
| explore | image URLs not /pub/<uuid> | 38 | 38 |
| explore | texts with raw HTML | 12 | 4 ↓ |
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
| photographs | texts with raw HTML | 1 | 0 ↓ |
| porcelain | image URLs not /pub/<uuid> | 2 | 2 |
| portraits | image URLs not /pub/<uuid> | 1 | 1 |
| precious-stones | image URLs not /pub/<uuid> | 1 | 1 |
| prints-drawings | image URLs not /pub/<uuid> | 1 | 1 |
| religious-life | image URLs not /pub/<uuid> | 5 | 5 |
| sculptures | image URLs not /pub/<uuid> | 3 | 3 |
| sharinghistory | image URLs not /pub/<uuid> | 4 | 4 |
| sharinghistory | texts with raw HTML | 10 | 4 ↓ |
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
| item.translation_copy_editor | 1011 | 3 | -1008 | 4070 → 0 | 29619 | 3 |
| event.date text.en | 84 | 0 | -84 | 0 → 0 | 58380 | 0 |
| item.author | 73 | 5 | -68 | 8752 → 314 | 29619 | 3 |
| partner.languages | 48 | 1 | -47 | 0 → 0 | 2091 | 1 |
| item.image.count | 49 | 5 | -44 | 0 → 0 | 14849 | 3 |
| item.translator | 39 | 0 | -39 | 4945 → 0 | 29619 | 0 |
| item.bibliography | 36 | 0 | -36 | 22 → 22 | 25136 | 0 |
| item.location | 29 | 0 | -29 | 11560 → 8531 | 29617 | 0 |
| item.holder | 26 | 0 | -26 | 2371 → 2371 | 26985 | 0 |
| item.description | 35 | 11 | -24 | 226 → 0 | 26860 | 2 |
| item.country_id_present_days | 22 | 0 | -22 | 0 → 0 | 0 | 0 |
| item.alternate_name | 8 | 0 | -8 | 269 → 264 | 18435 | 0 |
| item.dates | 7 | 0 | -7 | 3259 → 3259 | 29296 | 0 |
| item.dynasty (free text) | 7 | 0 | -7 | 1527 → 1527 | 25107 | 0 |
| item.type | 6 | 0 | -6 | 0 → 0 | 20931 | 0 |
| item.dimensions | 5 | 0 | -5 | 3742 → 3742 | 24479 | 0 |
| item.short_description | 10 | 5 | -5 | 0 → 0 | 23885 | 4 |
| country.name | 4 | 0 | -4 | 0 → 0 | 169 | 0 |
| item.history | 4 | 0 | -4 | 228 → 0 | 1259 | 0 |
| item.provenance | 3 | 0 | -3 | 0 → 0 | 24699 | 0 |
| record.package language | 4 | 1 | -3 | 0 → 0 | 4 | 1 |
| item.artist | 2 | 0 | -2 | 44 → 44 | 19722 | 0 |
| item.copy_editor | 9 | 7 | -2 | 7246 → 4 | 29619 | 1 |
| item.method_for_datation | 4 | 2 | -2 | 0 → 0 | 24871 | 1 |
| item.patrons | 2 | 0 | -2 | 0 → 0 | 2010 | 0 |
| territory.description | 2 | 0 | -2 | 0 → 0 | 50 | 0 |
| territory.name | 2 | 0 | -2 | 0 → 0 | 50 | 0 |
| country.description | 1 | 0 | -1 | 0 → 0 | 25 | 0 |
| item.keywords | 1 | 0 | -1 | 0 → 0 | 17718 | 0 |
| item.start/end | 1 | 0 | -1 | 0 → 0 | 9173 | 0 |
| detail.description | 1 | 1 | 0 | 0 → 0 | 1628 | 1 |
| exhibition.related content | 1 | 1 | 0 | 0 → 0 | 5 | 1 |
| item.artist_birthdate | 3 | 3 | 0 | 0 → 0 | 3 | 1 |
| item.artist_birthplace | 1 | 1 | 0 | 0 → 0 | 1 | 1 |
| item.artist_deathdate | 2 | 2 | 0 | 0 → 0 | 2 | 1 |
| item.artist_deathplace | 1 | 1 | 0 | 0 → 0 | 1 | 1 |
| item.datation_method | 2 | 2 | 0 | 0 → 0 | 2 | 1 |
| item.image.photographer | 3 | 3 | 0 | 0 → 0 | 17718 | 1 |
| item.initial_owner | 0 | 0 | 0 | 891 → 891 | 18677 | 0 |
| item.name | 0 | 0 | 0 | 4863 → 4863 | 29615 | 0 |
| item.owner | 0 | 0 | 0 | 316 → 316 | 18143 | 0 |
| item.owner_reference | 6 | 6 | 0 | 68 → 68 | 12641 | 3 |
| item.second_name | 0 | 0 | 0 | 0 → 6 | 298 | 0 |
| item.third_name | 0 | 0 | 0 | 0 → 1 | 543 | 0 |
| membership.sh_exhibition_subthemes (assigned ∪ slideshow items) | 1 | 1 | 0 | 0 → 0 | 140 | 1 |
| membership.sh_exhibition_subthemes (assigned items) | 14 | 14 | 0 | 0 → 0 | 140 | 1 |
| membership.sh_exhibition_themes (assigned items) | 6 | 6 | 0 | 0 → 0 | 42 | 1 |
| membership.sh_exhibitions (assigned items) | 1 | 1 | 0 | 0 → 0 | 10 | 1 |
| membership.Travels monuments (count only) | 2 | 2 | 0 | 0 → 0 | 2 | 2 |
| partner.city | 9 | 9 | 0 | 0 → 0 | 4896 | 9 |
| partner.name | 2 | 2 | 0 | 28 → 28 | 4917 | 2 |
| site.banner item | 1 | 1 | 0 | 0 → 0 | 42 | 1 |
| site.hidden | 1 | 1 | 0 | 0 → 0 | 42 | 1 |
| sub-itinerary.monuments | 1 | 1 | 0 | 0 → 0 | 109 | 1 |
| theme.contextual descriptions (count) | 2 | 2 | 0 | 0 → 0 | 2 | 2 |
| theme.picture count | 25 | 25 | 0 | 0 → 0 | 129 | 2 |
| theme.presentation | 15 | 15 | 0 | 0 → 0 | 129 | 2 |
| theme.quote | 16 | 16 | 0 | 0 → 0 | 129 | 1 |
| theme.title | 11 | 11 | 0 | 0 → 0 | 129 | 2 |

## Sites

| Site | Real before | Real after | Unexplained before | after | Record sets off (after) |
|---|---|---|---|---|---|
| amulets | 1 | 0 | 1 | 0 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+1 |
| archaeology | 4 | 0 | 4 | 0 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+1 |
| architectural-elements | 1 | 0 | 1 | 0 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+2 |
| arms-armoury | 1 | 0 | 1 | 0 | ✓ |
| arts-in-dialogue | 7 | 7 | 7 | 7 | items (membership): −1/+3; item × language: −0/+22; partners: −1/+5; timeline events (country|year|text, en): −0/+4 |
| baroqueart | 12 | 4 | 8 | 0 | exhibitions: −1/+0; exhibition_themes: −3/+0; partners referenced by records: −4/+12 |
| calligraphy | 17 | 2 | 16 | 2 | items (membership): −0/+3; item × language: −2/+3; partners: −0/+3 |
| carpets | 3 | 1 | 2 | 1 | ✓ |
| ceramics | 12 | 2 | 10 | 2 | items (membership): −0/+2; item × language: −1/+2; partners: −0/+1 |
| clothing | 5 | 1 | 5 | 1 | items (membership): −0/+7; item × language: −0/+7; partners: −0/+2 |
| coins-medals | 3 | 0 | 3 | 0 | items (membership): −0/+9; item × language: −0/+9; partners: −0/+4 |
| communication | 1 | 0 | 1 | 0 | items (membership): −0/+17; item × language: −0/+17; partners: −0/+8 |
| explore | 9 | 0 | 9 | 0 | ✓ |
| funerary-objects | 2 | 1 | 2 | 1 | ✓ |
| galleries | 0 | 0 | 0 | 0 | ✓ |
| glass | 2 | 0 | 2 | 0 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+2 |
| gold-silver | 3 | 1 | 3 | 1 | items (membership): −0/+5; item × language: −1/+5; partners: −0/+2 |
| historical-cars | 0 | 0 | 0 | 0 | ✓ |
| islamicart | 60 | 12 | 48 | 12 | record × language (dump vs package): −4/+16; partners referenced by records: −10/+1 |
| ivory | 1 | 0 | 1 | 0 | ✓ |
| jewellery | 2 | 1 | 2 | 1 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+1 |
| landscapes | 1 | 0 | 1 | 0 | items (membership): −0/+13; item × language: −0/+13; partners: −0/+5 |
| leatherworks | 2 | 1 | 1 | 1 | items (membership): −0/+1; item × language: −0/+1; partners: −0/+1 |
| manuscripts | 8 | 0 | 8 | 0 | items (membership): −0/+8; item × language: −1/+8; partners: −0/+4 |
| metalwork | 6 | 0 | 6 | 0 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+1 |
| mosaics | 1 | 0 | 1 | 0 | ✓ |
| musical-instruments | 0 | 0 | 0 | 0 | ✓ |
| paintings | 3 | 0 | 3 | 0 | items (membership): −0/+18; item × language: −0/+18; partners: −0/+7 |
| photographs | 5 | 1 | 5 | 1 | items (membership): −0/+100; item × language: −0/+100; partners: −0/+11; countries (items ∪ timeline ∪ partners): −0/+1 |
| porcelain | 1 | 0 | 1 | 0 | ✓ |
| portraits | 3 | 1 | 3 | 1 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+2 |
| precious-stones | 3 | 0 | 3 | 0 | ✓ |
| prints-drawings | 12 | 3 | 10 | 1 | items (membership): −0/+29; item × language: −0/+29; partners: −0/+7 |
| religious-life | 4 | 0 | 3 | 0 | items (membership): −0/+5; item × language: −0/+5; partners: −0/+2 |
| scientific-objects | 5 | 2 | 4 | 1 | items (membership): −0/+3; item × language: −0/+3; partners: −0/+2 |
| sculptures | 3 | 0 | 2 | 0 | items (membership): −0/+2; item × language: −0/+2; partners: −0/+2 |
| sharinghistory | 40 | 3 | 40 | 3 | record × language (dump vs package): −1/+0; partners referenced by records: −0/+15 |
| textiles | 0 | 0 | 0 | 0 | items (membership): −0/+9; item × language: −0/+9; partners: −0/+2 |
| the-hijaz-railway | — | — | — | — | ✓ |
| the-table-is-set | 21 | 3 | 21 | 3 | items (membership): −0/+2; item × language: −2/+13; partners: −1/+0 |
| the-use-of-colours-in-art | 2 | 0 | 2 | 0 | items (membership): −1/+1; item × language: −0/+6; partners: −2/+1; timeline events (country|year|text, en): −0/+45 |
| theatre | 0 | 0 | 0 | 0 | ✓ |
| toys-games | 0 | 0 | 0 | 0 | ✓ |
| wallpaintings | 3 | 0 | 3 | 0 | ✓ |
| water-in-islam | 10 | 2 | 10 | 2 | items (membership): −0/+3; item × language: −0/+4; partners: −2/+11 |
| weights-measures | 0 | 0 | 0 | 0 | ✓ |
| with-brush-and-qalam | 0 | 0 | 0 | 0 | ✓ |
| woodwork | 8 | 1 | 8 | 1 | items (membership): −0/+3; item × language: −0/+3; partners: −0/+1 |
