<?php

namespace Tests\Api\Resources;

use App\Models\Collection;
use App\Models\CollectionImage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\Api\Traits\TestsApiImageResource;
use Tests\Api\Traits\TestsApiImageViewing;
use Tests\TestCase;

class CollectionImageTest extends TestCase
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
        return 'collection-image';
    }

    protected function getModelClass(): string
    {
        return CollectionImage::class;
    }

    protected function servesBurnedImage(): bool
    {
        return true;
    }

    protected function getParentModel()
    {
        return Collection::factory()->create();
    }

    protected function getParentRelation(): string
    {
        return 'collection';
    }

    protected function usesNestedRoutes(): bool
    {
        return true;
    }
}
