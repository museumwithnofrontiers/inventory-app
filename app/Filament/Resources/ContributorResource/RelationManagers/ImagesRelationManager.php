<?php

namespace App\Filament\Resources\ContributorResource\RelationManagers;

use App\Filament\Resources\RelationManagers\BaseImagesRelationManager;
use App\Models\ContributorImage;

class ImagesRelationManager extends BaseImagesRelationManager
{
    protected static string $relationship = 'contributorImages';

    protected static ?string $title = 'Pictures';

    protected function imageModelClass(): string
    {
        return ContributorImage::class;
    }

    protected function ownerForeignKey(): string
    {
        return 'contributor_id';
    }

    protected function ownerRouteParameter(): string
    {
        return 'contributor';
    }

    protected function imageRouteParameter(): string
    {
        return 'contributorImage';
    }

    protected function imageViewRouteName(): string
    {
        return 'filament.admin.contributor-image.view';
    }

    protected function imageDownloadRouteName(): string
    {
        return 'filament.admin.contributor-image.download';
    }
}
