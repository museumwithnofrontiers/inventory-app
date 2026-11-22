<?php

namespace App\Http\Controllers\Filament;

use App\Http\Controllers\Controller;
use App\Http\Responses\Image\DownloadImageResponse;
use App\Http\Responses\Image\InlineImageResponse;
use App\Models\Partner;
use App\Models\PartnerImage;

class PartnerImageController extends Controller
{
    public function view(Partner $partner, PartnerImage $partnerImage): InlineImageResponse
    {
        $this->authorize('view', $partnerImage);

        if ($partnerImage->partner_id !== $partner->id) {
            abort(404);
        }

        return new InlineImageResponse($partnerImage);
    }

    public function download(Partner $partner, PartnerImage $partnerImage): DownloadImageResponse
    {
        $this->authorize('view', $partnerImage);

        if ($partnerImage->partner_id !== $partner->id) {
            abort(404);
        }

        return new DownloadImageResponse($partnerImage);
    }
}
