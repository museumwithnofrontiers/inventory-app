<?php

namespace Tests\Api\Resources;

use App\Models\Item;
use App\Models\ItemImage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\Api\Traits\TestsApiImageResource;
use Tests\Api\Traits\TestsApiImageViewing;
use Tests\TestCase;

class ItemImageTest extends TestCase
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
        return 'item-image';
    }

    protected function getModelClass(): string
    {
        return ItemImage::class;
    }

    protected function servesBurnedImage(): bool
    {
        return true;
    }

    protected function getParentModel()
    {
        return Item::factory()->create();
    }

    protected function getParentRelation(): string
    {
        return 'item';
    }

    protected function usesNestedRoutes(): bool
    {
        return true;
    }
}
