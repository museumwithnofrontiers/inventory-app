<?php

namespace App\Http\Controllers\Filament;

use App\Http\Controllers\Controller;
use App\Http\Responses\Image\DownloadImageResponse;
use App\Http\Responses\Image\InlineImageResponse;
use App\Models\Partner;
use App\Models\PartnerLogo;

/**
 * The panel's view and download of a partner logo: the original, as for the
 * partner's images.
 */
class PartnerLogoController extends Controller
{
    public function view(Partner $partner, PartnerLogo $partnerLogo): InlineImageResponse
    {
        if ($partnerLogo->partner_id !== $partner->id) {
            abort(404);
        }

        return new InlineImageResponse($partnerLogo);
    }

    public function download(Partner $partner, PartnerLogo $partnerLogo): DownloadImageResponse
    {
        if ($partnerLogo->partner_id !== $partner->id) {
            abort(404);
        }

        return new DownloadImageResponse($partnerLogo);
    }
}
