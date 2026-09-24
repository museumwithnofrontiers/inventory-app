<?php

namespace Tests\Api\Resources;

use App\Models\Partner;
use App\Models\PartnerImage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\Api\Traits\TestsApiImageResource;
use Tests\Api\Traits\TestsApiImageViewing;
use Tests\TestCase;

class PartnerImageTest extends TestCase
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
        return 'partner-image';
    }

    protected function getModelClass(): string
    {
        return PartnerImage::class;
    }

    protected function servesBurnedImage(): bool
    {
        return true;
    }

    protected function getParentModel()
    {
        return Partner::factory()->create();
    }

    protected function getParentRelation(): string
    {
        return 'partner';
    }
}
