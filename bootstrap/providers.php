<?php

use App\Providers\AppServiceProvider;
use App\Providers\Filament\AdminPanelProvider;
use App\Providers\FortifyServiceProvider;
use App\Providers\LocalImageFakerServiceProvider;
use Intervention\Image\ImageServiceProvider;

return [
    AppServiceProvider::class,
    AdminPanelProvider::class,
    FortifyServiceProvider::class,
    LocalImageFakerServiceProvider::class,
    ImageServiceProvider::class,
];
