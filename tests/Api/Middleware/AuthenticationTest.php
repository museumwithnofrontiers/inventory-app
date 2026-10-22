<?php

namespace Tests\Api\Middleware;

use App\Models\AvailableImage;
use App\Models\Collection;
use App\Models\CollectionImage;
use App\Models\CollectionTranslation;
use App\Models\Context;
use App\Models\Country;
use App\Models\Glossary;
use App\Models\GlossarySpelling;
use App\Models\GlossaryTranslation;
use App\Models\ImageUpload;
use App\Models\Item;
use App\Models\ItemImage;
use App\Models\ItemTranslation;
use App\Models\Language;
use App\Models\Partner;
use App\Models\PartnerImage;
use App\Models\PartnerTranslation;
use App\Models\PartnerTranslationImage;
use App\Models\Project;
use App\Models\Tag;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Test that ALL API routes reject unauthenticated requests
 *
 * This test ensures every API endpoint requires an OAuth (Passport) token
 */
class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Data provider for API routes requiring authentication
     *
     * Format: [method, route, ?modelClass]
     */
    public static function protectedRoutesProvider(): array
    {
        return [
            // AvailableImage routes
            ['GET', 'available-image.index', null],
            ['GET', 'available-image.show', AvailableImage::class],
            ['DELETE', 'available-image.destroy', AvailableImage::class],
            ['PATCH', 'available-image.update', AvailableImage::class],
            ['GET', 'available-image.download', AvailableImage::class],
            ['GET', 'available-image.view', AvailableImage::class],

            // Collection routes
            ['GET', 'collection.index', null],
            ['POST', 'collection.store', null],
            ['GET', 'collection.show', Collection::class],
            ['PATCH', 'collection.update', Collection::class],
            ['DELETE', 'collection.destroy', Collection::class],
            ['POST', 'collection.attachImage', Collection::class],
            ['POST', 'collection.attachItem', Collection::class],
            ['POST', 'collection.attachItems', Collection::class],
            ['DELETE', 'collection.detachItem', Collection::class],
            ['DELETE', 'collection.detachItems', Collection::class],
            ['GET', 'collection.images.index', Collection::class],
            ['POST', 'collection.images.store', Collection::class],

            // CollectionImage routes
            ['GET', 'collection-image.show', CollectionImage::class],
            ['PATCH', 'collection-image.update', CollectionImage::class],
            ['DELETE', 'collection-image.destroy', CollectionImage::class],
            ['POST', 'collection-image.detach', CollectionImage::class],
            ['GET', 'collection-image.download', CollectionImage::class],
            ['PATCH', 'collection-image.moveDown', CollectionImage::class],
            ['PATCH', 'collection-image.moveUp', CollectionImage::class],
            ['PATCH', 'collection-image.tightenOrdering', CollectionImage::class],
            ['GET', 'collection-image.view', CollectionImage::class],

            // CollectionTranslation routes
            ['GET', 'collection-translation.index', null],
            ['POST', 'collection-translation.store', null],
            ['GET', 'collection-translation.show', CollectionTranslation::class],
            ['PATCH', 'collection-translation.update', CollectionTranslation::class],
            ['DELETE', 'collection-translation.destroy', CollectionTranslation::class],

            // Context routes
            ['GET', 'context.index', null],
            ['POST', 'context.store', null],
            ['GET', 'context.getDefault', null],
            ['DELETE', 'context.clearDefault', null],
            ['GET', 'context.show', Context::class],
            ['PATCH', 'context.update', Context::class],
            ['DELETE', 'context.destroy', Context::class],
            ['PATCH', 'context.setDefault', Context::class],

            // Country routes
            ['GET', 'country.index', null],
            ['POST', 'country.store', null],
            ['GET', 'country.show', Country::class],
            ['PATCH', 'country.update', Country::class],
            ['DELETE', 'country.destroy', Country::class],

            // Glossary routes
            ['GET', 'glossary.index', null],
            ['POST', 'glossary.store', null],
            ['GET', 'glossary.show', Glossary::class],
            ['PATCH', 'glossary.update', Glossary::class],
            ['DELETE', 'glossary.destroy', Glossary::class],
            ['POST', 'glossary.attachSynonym', Glossary::class],
            ['DELETE', 'glossary.detachSynonym', Glossary::class],

            // GlossarySpelling routes
            ['GET', 'glossary-spelling.index', null],
            ['POST', 'glossary-spelling.store', null],
            ['GET', 'glossary-spelling.show', GlossarySpelling::class],
            ['PATCH', 'glossary-spelling.update', GlossarySpelling::class],
            ['DELETE', 'glossary-spelling.destroy', GlossarySpelling::class],

            // GlossaryTranslation routes
            ['GET', 'glossary-translation.index', null],
            ['POST', 'glossary-translation.store', null],
            ['GET', 'glossary-translation.show', GlossaryTranslation::class],
            ['PATCH', 'glossary-translation.update', GlossaryTranslation::class],
            ['DELETE', 'glossary-translation.destroy', GlossaryTranslation::class],

            // ImageUpload routes
            ['GET', 'image-upload.index', null],
            ['POST', 'image-upload.store', null],
            ['GET', 'image-upload.show', ImageUpload::class],
            ['DELETE', 'image-upload.destroy', ImageUpload::class],

            // Item routes
            ['GET', 'item.index', null],
            ['POST', 'item.store', null],
            ['GET', 'item.children', null],
            ['GET', 'item.forTag', Tag::class], // Special: item/for-tag/{tag}
            ['GET', 'item.parents', null],
            ['POST', 'item.withAllTags', null],
            ['POST', 'item.withAnyTags', null],
            ['GET', 'item.show', Item::class],
            ['PATCH', 'item.update', Item::class],
            ['DELETE', 'item.destroy', Item::class],
            ['POST', 'item.attachImage', Item::class],
            ['POST', 'item.attachTag', Item::class],
            ['POST', 'item.attachTags', Item::class],
            ['DELETE', 'item.detachTag', Item::class],
            ['DELETE', 'item.detachTags', Item::class],
            ['GET', 'item.images.index', Item::class],
            ['POST', 'item.images.store', Item::class],
            ['PATCH', 'item.updateTags', Item::class],

            // ItemImage routes
            ['GET', 'item-image.show', ItemImage::class],
            ['PATCH', 'item-image.update', ItemImage::class],
            ['DELETE', 'item-image.destroy', ItemImage::class],
            ['POST', 'item-image.detach', ItemImage::class],
            ['GET', 'item-image.download', ItemImage::class],
            ['PATCH', 'item-image.moveDown', ItemImage::class],
            ['PATCH', 'item-image.moveUp', ItemImage::class],
            ['PATCH', 'item-image.tightenOrdering', ItemImage::class],
            ['GET', 'item-image.view', ItemImage::class],

            // ItemTranslation routes
            ['GET', 'item-translation.index', null],
            ['POST', 'item-translation.store', null],
            ['GET', 'item-translation.show', ItemTranslation::class],
            ['PATCH', 'item-translation.update', ItemTranslation::class],
            ['DELETE', 'item-translation.destroy', ItemTranslation::class],

            // Language routes
            ['GET', 'language.index', null],
            ['POST', 'language.store', null],
            ['GET', 'language.getDefault', null],
            ['DELETE', 'language.clearDefault', null],
            ['GET', 'language.getEnglish', null],
            ['GET', 'language.show', Language::class],
            ['PATCH', 'language.update', Language::class],
            ['DELETE', 'language.destroy', Language::class],
            ['PATCH', 'language.setDefault', Language::class],

            // Partner routes
            ['GET', 'partner.index', null],
            ['POST', 'partner.store', null],
            ['GET', 'partner.show', Partner::class],
            ['PATCH', 'partner.update', Partner::class],
            ['DELETE', 'partner.destroy', Partner::class],
            ['POST', 'partner.attachImage', Partner::class],

            // PartnerImage routes
            ['GET', 'partner-image.index', null],
            ['POST', 'partner-image.store', null],
            ['GET', 'partner-image.show', PartnerImage::class],
            ['PATCH', 'partner-image.update', PartnerImage::class],
            ['DELETE', 'partner-image.destroy', PartnerImage::class],
            ['POST', 'partner-image.detach', PartnerImage::class],
            ['GET', 'partner-image.download', PartnerImage::class],
            ['PATCH', 'partner-image.moveDown', PartnerImage::class],
            ['PATCH', 'partner-image.moveUp', PartnerImage::class],
            ['PATCH', 'partner-image.tightenOrdering', PartnerImage::class],
            ['GET', 'partner-image.view', PartnerImage::class],

            // PartnerTranslation routes
            ['GET', 'partner-translation.index', null],
            ['POST', 'partner-translation.store', null],
            ['GET', 'partner-translation.show', PartnerTranslation::class],
            ['PATCH', 'partner-translation.update', PartnerTranslation::class],
            ['DELETE', 'partner-translation.destroy', PartnerTranslation::class],
            ['POST', 'partner-translation.attachImage', PartnerTranslation::class],

            // PartnerTranslationImage routes
            ['GET', 'partner-translation-image.index', null],
            ['POST', 'partner-translation-image.store', null],
            ['GET', 'partner-translation-image.show', PartnerTranslationImage::class],
            ['PATCH', 'partner-translation-image.update', PartnerTranslationImage::class],
            ['DELETE', 'partner-translation-image.destroy', PartnerTranslationImage::class],
            ['POST', 'partner-translation-image.detach', PartnerTranslationImage::class],
            ['GET', 'partner-translation-image.download', PartnerTranslationImage::class],
            ['PATCH', 'partner-translation-image.moveDown', PartnerTranslationImage::class],
            ['PATCH', 'partner-translation-image.moveUp', PartnerTranslationImage::class],
            ['PATCH', 'partner-translation-image.tightenOrdering', PartnerTranslationImage::class],
            ['GET', 'partner-translation-image.view', PartnerTranslationImage::class],

            // Project routes
            ['GET', 'project.index', null],
            ['POST', 'project.store', null],
            ['GET', 'project.enabled', null],
            ['GET', 'project.show', Project::class],
            ['PATCH', 'project.update', Project::class],
            ['DELETE', 'project.destroy', Project::class],
            ['PATCH', 'project.setEnabled', Project::class],
            ['PATCH', 'project.setLaunched', Project::class],

            // Tag routes
            ['GET', 'tag.index', null],
            ['POST', 'tag.store', null],
            ['GET', 'tag.forItem', Item::class], // Special: tag/for-item/{item}
            ['GET', 'tag.show', Tag::class],
            ['PATCH', 'tag.update', Tag::class],
            ['DELETE', 'tag.destroy', Tag::class],
        ];
    }

    #[DataProvider('protectedRoutesProvider')]
    public function test_route_requires_authentication(string $method, string $route, ?string $modelClass): void
    {
        $routeParams = $this->getRouteParams($modelClass);

        $response = $this->{strtolower($method).'Json'}(route($route, $routeParams), []);

        $response->assertUnauthorized();
    }

    /**
     * Get route parameters for routes that need a model instance
     */
    private function getRouteParams(?string $modelClass): array
    {
        if (! $modelClass) {
            return [];
        }

        // Create model instance for route binding
        $model = $modelClass::factory()->create();

        return [$model];
    }
}
