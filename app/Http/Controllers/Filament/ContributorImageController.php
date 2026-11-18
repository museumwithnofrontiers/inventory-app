<?php

namespace App\Http\Controllers\Filament;

use App\Http\Controllers\Controller;
use App\Http\Responses\Image\DownloadImageResponse;
use App\Http\Responses\Image\InlineImageResponse;
use App\Models\Contributor;
use App\Models\ContributorImage;

class ContributorImageController extends Controller
{
    public function view(Contributor $contributor, ContributorImage $contributorImage): InlineImageResponse
    {
        if ($contributorImage->contributor_id !== $contributor->id) {
            abort(404);
        }

        return new InlineImageResponse($contributorImage);
    }

    public function download(Contributor $contributor, ContributorImage $contributorImage): DownloadImageResponse
    {
        if ($contributorImage->contributor_id !== $contributor->id) {
            abort(404);
        }

        return new DownloadImageResponse($contributorImage);
    }
}
