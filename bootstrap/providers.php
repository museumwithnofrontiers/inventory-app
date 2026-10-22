<?php

use App\Providers\AppServiceProvider;
use App\Providers\Filament\AdminPanelProvider;
use App\Providers\FortifyServiceProvider;
use App\Providers\LocalImageFakerServiceProvider;
use App\Providers\OAuthServiceProvider;
use Intervention\Image\ImageServiceProvider;

return [
    AppServiceProvider::class,
    AdminPanelProvider::class,
    FortifyServiceProvider::class,
    LocalImageFakerServiceProvider::class,
    OAuthServiceProvider::class,
    ImageServiceProvider::class,
];
