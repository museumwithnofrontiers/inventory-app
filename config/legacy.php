<?php

return [
    'links' => [
        'public_hosts' => [
            'projects' => [
                'ISL' => 'https://islamicart.museumwnf.org',
                'IAM' => 'https://islamicart.museumwnf.org',
                'EPM' => 'https://islamicart.museumwnf.org',
                'BAR' => 'https://baroqueart.museumwnf.org',
                'AMA' => 'https://baroqueart.museumwnf.org',
                'AMT' => 'https://baroqueart.museumwnf.org',
                'DCA' => 'https://islamicart.museumwnf.org',
                'DGA' => 'https://islamicart.museumwnf.org',
                'AMU' => 'https://islamicart.museumwnf.org',
                'EXHCOLOUR' => 'https://islamicart.museumwnf.org',
                'EXAID' => 'https://islamicart.museumwnf.org',
                'EXTHE' => 'https://islamicart.museumwnf.org',
                'EXWIT' => 'https://islamicart.museumwnf.org',
                'GalEx5' => 'https://islamicart.museumwnf.org',
                'GalEx6' => 'https://islamicart.museumwnf.org',
                'GALLERIES' => 'https://islamicart.museumwnf.org',
            ],
            'sharing_history' => 'https://sharinghistory.museumwnf.org',
            'explore' => 'https://explore.museumwnf.org',
            'travels' => 'https://travels.museumwnf.org',
            'portal' => 'https://museumwnf.org',
            'exhibitions' => 'https://exhibitions.museumwnf.org',
        ],

        'backoffice_host' => 'https://virtual-office.museumwnf.org',

        'languages' => [
            'eng' => 'en',
            'fra' => 'fr',
            'deu' => 'de',
            'spa' => 'es',
            'ita' => 'it',
            'por' => 'pt',
            'ara' => 'ar',
        ],

        'sharing_history_project' => 'AWE',

        // The landing page of the projects that had a site of their own.
        'project_landing_pages' => [
            'ISL' => 'https://islamicart.museumwnf.org/index.php',
            'BAR' => 'https://baroqueart.museumwnf.org/index.php',
        ],

        // The folder of each mwnf3 exhibition (legacy exhibitions.exh_link,
        // which the inventory does not keep). Each folder pins its id in
        // libs/config.inc.php ($_SESSION["exhibition"]).
        'mwnf3_exhibitions' => [
            '10' => 'https://islamicart.museumwnf.org/exhibitions/ISL/the_umayyads',
            '13' => 'https://islamicart.museumwnf.org/exhibitions/ISL/the_abbasids',
            '15' => 'https://islamicart.museumwnf.org/exhibitions/ISL/the_ayyubids',
            '16' => 'https://islamicart.museumwnf.org/exhibitions/ISL/fatimids',
            '17' => 'https://islamicart.museumwnf.org/exhibitions/ISL/the_mamluks',
            '18' => 'https://islamicart.museumwnf.org/exhibitions/ISL/the_ottomans',
            '19' => 'https://islamicart.museumwnf.org/exhibitions/ISL/arabic_calligraphy',
            '20' => 'https://islamicart.museumwnf.org/exhibitions/ISL/figural',
            '21' => 'https://islamicart.museumwnf.org/exhibitions/ISL/geometric',
            '22' => 'https://islamicart.museumwnf.org/exhibitions/ISL/water',
            '23' => 'https://islamicart.museumwnf.org/exhibitions/ISL/women',
            '24' => 'https://islamicart.museumwnf.org/exhibitions/ISL/crusader',
            '25' => 'https://islamicart.museumwnf.org/exhibitions/ISL/siculo_norman',
            '26' => 'https://islamicart.museumwnf.org/exhibitions/ISL/mudejar_art',
            '27' => 'https://islamicart.museumwnf.org/exhibitions/ISL/muslim_west',
            '28' => 'https://islamicart.museumwnf.org/exhibitions/ISL/floral',
            '29' => 'https://islamicart.museumwnf.org/exhibitions/ISL/pilgrimage',
            '42' => 'https://islamicart.museumwnf.org/exhibitions/ISL/western_influence',
            '43' => 'https://baroqueart.museumwnf.org/exhibitions/BAR/ephemera',
            '44' => 'https://baroqueart.museumwnf.org/exhibitions/BAR/travelling_and_exotism',
            '45' => 'https://baroqueart.museumwnf.org/exhibitions/BAR/enlightenment',
            '46' => 'https://baroqueart.museumwnf.org/exhibitions/BAR/absolutism',
            '47' => 'https://baroqueart.museumwnf.org/exhibitions/BAR/devotion',
            '48' => 'https://baroqueart.museumwnf.org/exhibitions/BAR/languages_baroque',
            '49' => 'https://baroqueart.museumwnf.org/exhibitions/BAR/academia',
            '50' => 'https://baroqueart.museumwnf.org/exhibitions/BAR/bourgeoisie',
            '51' => 'https://baroqueart.museumwnf.org/exhibitions/BAR/reformation',
        ],

        // The list of a project's mwnf3 exhibitions (mwnf3:exhibitions:root[:CODE]).
        'mwnf3_exhibition_lists' => [
            'ISL' => 'https://islamicart.museumwnf.org/exhibitions/ISL',
            'BAR' => 'https://baroqueart.museumwnf.org/exhibitions/BAR',
        ],

        // The folder of each mwnf3 artistic introduction (gai/<project>, which
        // pins its id in libs/config.inc.php).
        'mwnf3_artintros' => [
            '1' => 'https://islamicart.museumwnf.org/gai/ISL',
        ],

        // Landing pages of the sites the importer's marker collections stand for.
        'root_landing_pages' => [
            'mwnf3_explore' => 'https://explore.museumwnf.org/',
            'mwnf3_travels' => 'https://travels.museumwnf.org/',
            'thg_galleries' => 'https://galleries.museumwnf.org/',
            'thg_exhibitions' => 'https://exhibitions.museumwnf.org/index.php/en/',
        ],

        'thematic_galleries' => [
            '4' => [
                'base_url' => 'https://amulets.museumwnf.org',
                'path' => '',
            ],
            '5' => [
                'base_url' => 'https://archaeology.museumwnf.org',
                'path' => '',
            ],
            '6' => [
                'base_url' => 'https://architectural-elements.museumwnf.org',
                'path' => '',
            ],
            '7' => [
                'base_url' => 'https://arms-armoury.museumwnf.org',
                'path' => '',
            ],
            '8' => [
                'base_url' => 'https://calligraphy.museumwnf.org',
                'path' => '',
            ],
            '9' => [
                'base_url' => 'https://carpets.museumwnf.org',
                'path' => '',
            ],
            '11' => [
                'base_url' => 'https://ceramics.museumwnf.org',
                'path' => '',
            ],
            '12' => [
                'base_url' => 'https://clothing.museumwnf.org',
                'path' => '',
            ],
            '13' => [
                'base_url' => 'https://coins-medals.museumwnf.org',
                'path' => '',
            ],
            '14' => [
                'base_url' => 'https://communication.museumwnf.org',
                'path' => '',
            ],
            '16' => [
                'base_url' => 'https://funerary-objects.museumwnf.org',
                'path' => '',
            ],
            '17' => [
                'base_url' => 'https://woodwork.museumwnf.org',
                'path' => '',
            ],
            '18' => [
                'base_url' => 'https://glass.museumwnf.org',
                'path' => '',
            ],
            '19' => [
                'base_url' => 'https://gold-silver.museumwnf.org',
                'path' => '',
            ],
            '20' => [
                'base_url' => 'https://ivory.museumwnf.org',
                'path' => '',
            ],
            '21' => [
                'base_url' => 'https://jewellery.museumwnf.org',
                'path' => '',
            ],
            '22' => [
                'base_url' => 'https://landscapes.museumwnf.org',
                'path' => '',
            ],
            '23' => [
                'base_url' => 'https://leatherworks.museumwnf.org',
                'path' => '',
            ],
            '24' => [
                'base_url' => 'https://manuscripts.museumwnf.org',
                'path' => '',
            ],
            '25' => [
                'base_url' => 'https://metalwork.museumwnf.org',
                'path' => '',
            ],
            '26' => [
                'base_url' => 'https://mosaics.museumwnf.org',
                'path' => '',
            ],
            '27' => [
                'base_url' => 'https://musical-instruments.museumwnf.org',
                'path' => '',
            ],
            '28' => [
                'base_url' => 'https://paintings.museumwnf.org',
                'path' => '',
            ],
            '29' => [
                'base_url' => 'https://photographs.museumwnf.org',
                'path' => '',
            ],
            '30' => [
                'base_url' => 'https://porcelain.museumwnf.org',
                'path' => '',
            ],
            '31' => [
                'base_url' => 'https://portraits.museumwnf.org',
                'path' => '',
            ],
            '32' => [
                'base_url' => 'https://prints-drawings.museumwnf.org',
                'path' => '',
            ],
            '33' => [
                'base_url' => 'https://religious-life.museumwnf.org',
                'path' => '',
            ],
            '34' => [
                'base_url' => 'https://scientific-objects.museumwnf.org',
                'path' => '',
            ],
            '35' => [
                'base_url' => 'https://sculptures.museumwnf.org',
                'path' => '',
            ],
            '37' => [
                'base_url' => 'https://textiles.museumwnf.org',
                'path' => '',
            ],
            '38' => [
                'base_url' => 'https://theatre.museumwnf.org',
                'path' => '',
            ],
            '39' => [
                'base_url' => 'https://toys-games.museumwnf.org',
                'path' => '',
            ],
            '40' => [
                'base_url' => 'https://wallpaintings.museumwnf.org',
                'path' => '',
            ],
            '41' => [
                'base_url' => 'https://weights-measures.museumwnf.org',
                'path' => '',
            ],
            '43' => [
                'base_url' => 'https://unclear-doubts-excluded.museumwnf.org',
                'path' => '',
            ],
            '45' => [
                'base_url' => 'https://gallery-partners.museumwnf.org',
                'path' => '',
            ],
            '46' => [
                'base_url' => 'https://precious-stones.museumwnf.org',
                'path' => '',
            ],
            '47' => [
                'base_url' => 'https://exhibitions.museumwnf.org',
                'path' => 'the_use_of_colours_in_art/{lang}',
            ],
            '49' => [
                'base_url' => 'https://cars.museumwnf.org',
                'path' => '',
            ],
            '50' => [
                'base_url' => 'https://exhibitions.museumwnf.org',
                'path' => 'with_brush_and_qalam/{lang}',
            ],
            '52' => [
                'base_url' => 'https://exhibitions.museumwnf.org',
                'path' => 'the_table_is_set/{lang}',
            ],
            '54' => [
                'base_url' => 'https://exhibitions.museumwnf.org',
                'path' => 'arts_in_dialogue/{lang}',
            ],
            '55' => [
                'base_url' => 'https://upgrade-exhibitions.museumwnf.org',
                'path' => 'the_hijaz_railway/{lang}',
            ],
            '56' => [
                'base_url' => 'https://exhibitions.museumwnf.org',
                'path' => 'water_in_islam/{lang}',
            ],
        ],
    ],
];
