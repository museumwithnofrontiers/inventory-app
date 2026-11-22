<?php

namespace App\Http\Controllers\Filament;

use App\Http\Controllers\Controller;
use App\Http\Responses\Image\DownloadImageResponse;
use App\Http\Responses\Image\InlineImageResponse;
use App\Models\PartnerTranslation;
use App\Models\PartnerTranslationImage;

class PartnerTranslationImageController extends Controller
{
    public function view(PartnerTranslation $partnerTranslation, PartnerTranslationImage $partnerTranslationImage): InlineImageResponse
    {
        $this->authorize('view', $partnerTranslationImage);

        if ($partnerTranslationImage->partner_translation_id !== $partnerTranslation->id) {
            abort(404);
        }

        return new InlineImageResponse($partnerTranslationImage);
    }

    public function download(PartnerTranslation $partnerTranslation, PartnerTranslationImage $partnerTranslationImage): DownloadImageResponse
    {
        $this->authorize('view', $partnerTranslationImage);

        if ($partnerTranslationImage->partner_translation_id !== $partnerTranslation->id) {
            abort(404);
        }

        return new DownloadImageResponse($partnerTranslationImage);
    }
}
