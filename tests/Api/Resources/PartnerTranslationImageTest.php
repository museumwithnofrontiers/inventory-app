<?php

namespace Tests\Api\Resources;

use App\Models\PartnerTranslation;
use App\Models\PartnerTranslationImage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\Api\Traits\TestsApiImageResource;
use Tests\Api\Traits\TestsApiImageViewing;
use Tests\TestCase;

class PartnerTranslationImageTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;
    use TestsApiImageResource;
    use TestsApiImageViewing {
        TestsApiImageResource::getFactoryData insteadof TestsApiImageViewing;
        TestsApiImageResource::hasColumn insteadof TestsApiImageViewing;
    }

    protected function getResourceName(): string
    {
        return 'partner-translation-image';
    }

    protected function getModelClass(): string
    {
        return PartnerTranslationImage::class;
    }

    protected function servesBurnedImage(): bool
    {
        return true;
    }

    protected function getParentModel()
    {
        return PartnerTranslation::factory()->create();
    }

    protected function getParentRelation(): string
    {
        return 'partnerTranslation';
    }
}
