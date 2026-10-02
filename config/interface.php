<?php

return [
    /*
    | Page size of the API's paginated lists (App\Support\Pagination\PaginationParams):
    | the default when a request sets none, and the most a request may ask for.
    */
    'pagination' => [
        'default_per_page' => env('WEB_DEFAULT_PER_PAGE', 10),
        'max_per_page' => env('WEB_MAX_PER_PAGE', 100),
    ],
];
