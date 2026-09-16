<?php

return [
    /*
    | Maximum page size exposed to the Blade interface. Keep in sync with
    | frontend constants.
    */
    'pagination' => [
        'default_per_page' => env('WEB_DEFAULT_PER_PAGE', 10),
        'max_per_page' => env('WEB_MAX_PER_PAGE', 100),
        'per_page_options' => [10, 20, 25, 50, 100],
    ],

    /*
    |--------------------------------------------------------------------------
    | SearchableSelect Component Configuration
    |--------------------------------------------------------------------------
    |
    | Controls the behaviour of the App\Livewire\SearchableSelect component.
    |
    | static_options_max — Maximum number of items accepted via staticOptions.
    |   Exceeding this ceiling causes mount() to throw InvalidArgumentException,
    |   forcing the caller to switch to dynamic mode (modelClass + scope).
    |
    | per_page — Default number of options returned by a dynamic DB query.
    |   Callers may override per request via the perPage prop.
    |
    */
    'searchable_select' => [
        'static_options_max' => env('SEARCHABLE_SELECT_STATIC_OPTIONS_MAX', 50),
        'per_page' => env('SEARCHABLE_SELECT_PER_PAGE', 50),
    ],
];
