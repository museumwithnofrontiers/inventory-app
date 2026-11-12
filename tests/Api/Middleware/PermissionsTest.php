<?php

namespace Tests\Api\Middleware;

use App\Enums\Permission;
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
use App\Models\Publication;
use App\Models\PublicationDocument;
use App\Models\PublicationEdition;
use App\Models\PublicationImage;
use App\Models\PublicationTranslation;
use App\Models\Tag;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Api\Traits\TestsApiPermissions;
use Tests\TestCase;

/**
 * Test that ALL API routes enforce correct permissions
 *
 * This test ensures proper permission middleware across all API endpoints
 */
class PermissionsTest extends TestCase
{
    use RefreshDatabase;
    use TestsApiPermissions;

    /**
     * Data provider for API routes and their required permissions
     *
     * Format: [method, route, permission, ?modelClass]
     */
    public static function routePermissionsProvider(): array
    {
        return [
            // AvailableImage routes
            ['GET', 'available-image.index', Permission::VIEW_DATA, null],
            ['GET', 'available-image.show', Permission::VIEW_DATA, AvailableImage::class],
            ['DELETE', 'available-image.destroy', Permission::DELETE_DATA, AvailableImage::class],
            ['PATCH', 'available-image.update', Permission::UPDATE_DATA, AvailableImage::class],
            ['GET', 'available-image.download', Permission::VIEW_DATA, AvailableImage::class],
            ['GET', 'available-image.view', Permission::VIEW_DATA, AvailableImage::class],

            // Collection routes
            ['GET', 'collection.index', Permission::VIEW_DATA, null],
            ['POST', 'collection.store', Permission::CREATE_DATA, null],
            ['GET', 'collection.show', Permission::VIEW_DATA, Collection::class],
            ['PATCH', 'collection.update', Permission::UPDATE_DATA, Collection::class],
            ['DELETE', 'collection.destroy', Permission::DELETE_DATA, Collection::class],
            ['POST', 'collection.attachImage', Permission::UPDATE_DATA, Collection::class],
            ['POST', 'collection.attachItem', Permission::UPDATE_DATA, Collection::class],
            ['POST', 'collection.attachItems', Permission::UPDATE_DATA, Collection::class],
            ['DELETE', 'collection.detachItem', Permission::UPDATE_DATA, Collection::class],
            ['DELETE', 'collection.detachItems', Permission::UPDATE_DATA, Collection::class],
            ['GET', 'collection.images.index', Permission::VIEW_DATA, Collection::class],
            ['POST', 'collection.images.store', Permission::CREATE_DATA, Collection::class],

            // CollectionImage routes
            ['GET', 'collection-image.show', Permission::VIEW_DATA, CollectionImage::class],
            ['PATCH', 'collection-image.update', Permission::UPDATE_DATA, CollectionImage::class],
            ['DELETE', 'collection-image.destroy', Permission::DELETE_DATA, CollectionImage::class],
            ['POST', 'collection-image.detach', Permission::UPDATE_DATA, CollectionImage::class],
            ['GET', 'collection-image.download', Permission::VIEW_DATA, CollectionImage::class],
            ['PATCH', 'collection-image.moveDown', Permission::UPDATE_DATA, CollectionImage::class],
            ['PATCH', 'collection-image.moveUp', Permission::UPDATE_DATA, CollectionImage::class],
            ['PATCH', 'collection-image.tightenOrdering', Permission::UPDATE_DATA, CollectionImage::class],
            ['GET', 'collection-image.view', Permission::VIEW_DATA, CollectionImage::class],

            // CollectionTranslation routes
            ['GET', 'collection-translation.index', Permission::VIEW_DATA, null],
            ['POST', 'collection-translation.store', Permission::CREATE_DATA, null],
            ['GET', 'collection-translation.show', Permission::VIEW_DATA, CollectionTranslation::class],
            ['PATCH', 'collection-translation.update', Permission::UPDATE_DATA, CollectionTranslation::class],
            ['DELETE', 'collection-translation.destroy', Permission::DELETE_DATA, CollectionTranslation::class],

            // Context routes
            ['GET', 'context.index', Permission::VIEW_DATA, null],
            ['POST', 'context.store', Permission::CREATE_DATA, null],
            ['GET', 'context.getDefault', Permission::VIEW_DATA, null],
            ['DELETE', 'context.clearDefault', Permission::UPDATE_DATA, null],
            ['GET', 'context.show', Permission::VIEW_DATA, Context::class],
            ['PATCH', 'context.update', Permission::UPDATE_DATA, Context::class],
            ['DELETE', 'context.destroy', Permission::DELETE_DATA, Context::class],
            ['PATCH', 'context.setDefault', Permission::UPDATE_DATA, Context::class],

            // Country routes
            ['GET', 'country.index', Permission::VIEW_DATA, null],
            ['POST', 'country.store', Permission::CREATE_DATA, null],
            ['GET', 'country.show', Permission::VIEW_DATA, Country::class],
            ['PATCH', 'country.update', Permission::UPDATE_DATA, Country::class],
            ['DELETE', 'country.destroy', Permission::DELETE_DATA, Country::class],

            // Glossary routes
            ['GET', 'glossary.index', Permission::VIEW_DATA, null],
            ['POST', 'glossary.store', Permission::CREATE_DATA, null],
            ['GET', 'glossary.show', Permission::VIEW_DATA, Glossary::class],
            ['PATCH', 'glossary.update', Permission::UPDATE_DATA, Glossary::class],
            ['DELETE', 'glossary.destroy', Permission::DELETE_DATA, Glossary::class],
            ['POST', 'glossary.attachSynonym', Permission::UPDATE_DATA, Glossary::class],
            ['DELETE', 'glossary.detachSynonym', Permission::UPDATE_DATA, Glossary::class],

            // GlossarySpelling routes
            ['GET', 'glossary-spelling.index', Permission::VIEW_DATA, null],
            ['POST', 'glossary-spelling.store', Permission::CREATE_DATA, null],
            ['GET', 'glossary-spelling.show', Permission::VIEW_DATA, GlossarySpelling::class],
            ['PATCH', 'glossary-spelling.update', Permission::UPDATE_DATA, GlossarySpelling::class],
            ['DELETE', 'glossary-spelling.destroy', Permission::DELETE_DATA, GlossarySpelling::class],

            // GlossaryTranslation routes
            ['GET', 'glossary-translation.index', Permission::VIEW_DATA, null],
            ['POST', 'glossary-translation.store', Permission::CREATE_DATA, null],
            ['GET', 'glossary-translation.show', Permission::VIEW_DATA, GlossaryTranslation::class],
            ['PATCH', 'glossary-translation.update', Permission::UPDATE_DATA, GlossaryTranslation::class],
            ['DELETE', 'glossary-translation.destroy', Permission::DELETE_DATA, GlossaryTranslation::class],

            // ImageUpload routes
            ['GET', 'image-upload.index', Permission::VIEW_DATA, null],
            ['POST', 'image-upload.store', Permission::CREATE_DATA, null],
            ['GET', 'image-upload.show', Permission::VIEW_DATA, ImageUpload::class],
            ['DELETE', 'image-upload.destroy', Permission::DELETE_DATA, ImageUpload::class],

            // Item routes
            ['GET', 'item.index', Permission::VIEW_DATA, null],
            ['POST', 'item.store', Permission::CREATE_DATA, null],
            ['GET', 'item.children', Permission::VIEW_DATA, null],
            ['GET', 'item.forTag', Permission::VIEW_DATA, Tag::class],
            ['GET', 'item.parents', Permission::VIEW_DATA, null],
            ['POST', 'item.withAllTags', Permission::VIEW_DATA, null],
            ['POST', 'item.withAnyTags', Permission::VIEW_DATA, null],
            ['GET', 'item.show', Permission::VIEW_DATA, Item::class],
            ['PATCH', 'item.update', Permission::UPDATE_DATA, Item::class],
            ['DELETE', 'item.destroy', Permission::DELETE_DATA, Item::class],
            ['POST', 'item.attachImage', Permission::UPDATE_DATA, Item::class],
            ['POST', 'item.attachTag', Permission::UPDATE_DATA, Item::class],
            ['POST', 'item.attachTags', Permission::UPDATE_DATA, Item::class],
            ['DELETE', 'item.detachTag', Permission::UPDATE_DATA, Item::class],
            ['DELETE', 'item.detachTags', Permission::UPDATE_DATA, Item::class],
            ['GET', 'item.images.index', Permission::VIEW_DATA, Item::class],
            ['POST', 'item.images.store', Permission::CREATE_DATA, Item::class],
            ['PATCH', 'item.updateTags', Permission::UPDATE_DATA, Item::class],

            // ItemImage routes
            ['GET', 'item-image.show', Permission::VIEW_DATA, ItemImage::class],
            ['PATCH', 'item-image.update', Permission::UPDATE_DATA, ItemImage::class],
            ['DELETE', 'item-image.destroy', Permission::DELETE_DATA, ItemImage::class],
            ['POST', 'item-image.detach', Permission::UPDATE_DATA, ItemImage::class],
            ['GET', 'item-image.download', Permission::VIEW_DATA, ItemImage::class],
            ['PATCH', 'item-image.moveDown', Permission::UPDATE_DATA, ItemImage::class],
            ['PATCH', 'item-image.moveUp', Permission::UPDATE_DATA, ItemImage::class],
            ['PATCH', 'item-image.tightenOrdering', Permission::UPDATE_DATA, ItemImage::class],
            ['GET', 'item-image.view', Permission::VIEW_DATA, ItemImage::class],

            // ItemTranslation routes
            ['GET', 'item-translation.index', Permission::VIEW_DATA, null],
            ['POST', 'item-translation.store', Permission::CREATE_DATA, null],
            ['GET', 'item-translation.show', Permission::VIEW_DATA, ItemTranslation::class],
            ['PATCH', 'item-translation.update', Permission::UPDATE_DATA, ItemTranslation::class],
            ['DELETE', 'item-translation.destroy', Permission::DELETE_DATA, ItemTranslation::class],

            // Language routes
            ['GET', 'language.index', Permission::VIEW_DATA, null],
            ['POST', 'language.store', Permission::CREATE_DATA, null],
            ['GET', 'language.getDefault', Permission::VIEW_DATA, null],
            ['DELETE', 'language.clearDefault', Permission::UPDATE_DATA, null],
            ['GET', 'language.getEnglish', Permission::VIEW_DATA, null],
            ['GET', 'language.show', Permission::VIEW_DATA, Language::class],
            ['PATCH', 'language.update', Permission::UPDATE_DATA, Language::class],
            ['DELETE', 'language.destroy', Permission::DELETE_DATA, Language::class],
            ['PATCH', 'language.setDefault', Permission::UPDATE_DATA, Language::class],

            // Partner routes
            ['GET', 'partner.index', Permission::VIEW_DATA, null],
            ['POST', 'partner.store', Permission::CREATE_DATA, null],
            ['GET', 'partner.show', Permission::VIEW_DATA, Partner::class],
            ['PATCH', 'partner.update', Permission::UPDATE_DATA, Partner::class],
            ['DELETE', 'partner.destroy', Permission::DELETE_DATA, Partner::class],
            ['POST', 'partner.attachImage', Permission::UPDATE_DATA, Partner::class],

            // PartnerImage routes
            ['GET', 'partner-image.index', Permission::VIEW_DATA, null],
            ['POST', 'partner-image.store', Permission::CREATE_DATA, null],
            ['GET', 'partner-image.show', Permission::VIEW_DATA, PartnerImage::class],
            ['PATCH', 'partner-image.update', Permission::UPDATE_DATA, PartnerImage::class],
            ['DELETE', 'partner-image.destroy', Permission::DELETE_DATA, PartnerImage::class],
            ['POST', 'partner-image.detach', Permission::UPDATE_DATA, PartnerImage::class],
            ['GET', 'partner-image.download', Permission::VIEW_DATA, PartnerImage::class],
            ['PATCH', 'partner-image.moveDown', Permission::UPDATE_DATA, PartnerImage::class],
            ['PATCH', 'partner-image.moveUp', Permission::UPDATE_DATA, PartnerImage::class],
            ['PATCH', 'partner-image.tightenOrdering', Permission::UPDATE_DATA, PartnerImage::class],
            ['GET', 'partner-image.view', Permission::VIEW_DATA, PartnerImage::class],

            // PartnerTranslation routes
            ['GET', 'partner-translation.index', Permission::VIEW_DATA, null],
            ['POST', 'partner-translation.store', Permission::CREATE_DATA, null],
            ['GET', 'partner-translation.show', Permission::VIEW_DATA, PartnerTranslation::class],
            ['PATCH', 'partner-translation.update', Permission::UPDATE_DATA, PartnerTranslation::class],
            ['DELETE', 'partner-translation.destroy', Permission::DELETE_DATA, PartnerTranslation::class],
            ['POST', 'partner-translation.attachImage', Permission::UPDATE_DATA, PartnerTranslation::class],

            // PartnerTranslationImage routes
            ['GET', 'partner-translation-image.index', Permission::VIEW_DATA, null],
            ['POST', 'partner-translation-image.store', Permission::CREATE_DATA, null],
            ['GET', 'partner-translation-image.show', Permission::VIEW_DATA, PartnerTranslationImage::class],
            ['PATCH', 'partner-translation-image.update', Permission::UPDATE_DATA, PartnerTranslationImage::class],
            ['DELETE', 'partner-translation-image.destroy', Permission::DELETE_DATA, PartnerTranslationImage::class],
            ['POST', 'partner-translation-image.detach', Permission::UPDATE_DATA, PartnerTranslationImage::class],
            ['GET', 'partner-translation-image.download', Permission::VIEW_DATA, PartnerTranslationImage::class],
            ['PATCH', 'partner-translation-image.moveDown', Permission::UPDATE_DATA, PartnerTranslationImage::class],
            ['PATCH', 'partner-translation-image.moveUp', Permission::UPDATE_DATA, PartnerTranslationImage::class],
            ['PATCH', 'partner-translation-image.tightenOrdering', Permission::UPDATE_DATA, PartnerTranslationImage::class],
            ['GET', 'partner-translation-image.view', Permission::VIEW_DATA, PartnerTranslationImage::class],

            // Project routes
            ['GET', 'project.index', Permission::VIEW_DATA, null],
            ['POST', 'project.store', Permission::CREATE_DATA, null],
            ['GET', 'project.enabled', Permission::VIEW_DATA, null],
            ['GET', 'project.show', Permission::VIEW_DATA, Project::class],
            ['PATCH', 'project.update', Permission::UPDATE_DATA, Project::class],
            ['DELETE', 'project.destroy', Permission::DELETE_DATA, Project::class],
            ['PATCH', 'project.setEnabled', Permission::UPDATE_DATA, Project::class],
            ['PATCH', 'project.setLaunched', Permission::UPDATE_DATA, Project::class],

            // Publication routes
            ['GET', 'publication.index', Permission::VIEW_DATA, null],
            ['POST', 'publication.store', Permission::CREATE_DATA, null],
            ['GET', 'publication.show', Permission::VIEW_DATA, Publication::class],
            ['PATCH', 'publication.update', Permission::UPDATE_DATA, Publication::class],
            ['DELETE', 'publication.destroy', Permission::DELETE_DATA, Publication::class],
            ['POST', 'publication.attachCollection', Permission::UPDATE_DATA, Publication::class],
            ['DELETE', 'publication.detachCollection', Permission::UPDATE_DATA, Publication::class],
            ['POST', 'publication.attachItem', Permission::UPDATE_DATA, Publication::class],
            ['DELETE', 'publication.detachItem', Permission::UPDATE_DATA, Publication::class],
            ['POST', 'publication.attachTag', Permission::UPDATE_DATA, Publication::class],
            ['POST', 'publication.attachTags', Permission::UPDATE_DATA, Publication::class],
            ['DELETE', 'publication.detachTag', Permission::UPDATE_DATA, Publication::class],
            ['DELETE', 'publication.detachTags', Permission::UPDATE_DATA, Publication::class],
            ['POST', 'publication.attachImage', Permission::CREATE_DATA, Publication::class],
            ['GET', 'publication.images.index', Permission::VIEW_DATA, Publication::class],
            ['POST', 'publication.images.store', Permission::CREATE_DATA, Publication::class],

            // PublicationTranslation routes
            ['GET', 'publication-translation.index', Permission::VIEW_DATA, null],
            ['POST', 'publication-translation.store', Permission::CREATE_DATA, null],
            ['GET', 'publication-translation.show', Permission::VIEW_DATA, PublicationTranslation::class],
            ['PATCH', 'publication-translation.update', Permission::UPDATE_DATA, PublicationTranslation::class],
            ['DELETE', 'publication-translation.destroy', Permission::DELETE_DATA, PublicationTranslation::class],

            // PublicationEdition routes: every change is an update of the publication
            ['GET', 'publication-edition.index', Permission::VIEW_DATA, null],
            ['POST', 'publication-edition.store', Permission::UPDATE_DATA, null],
            ['GET', 'publication-edition.show', Permission::VIEW_DATA, PublicationEdition::class],
            ['PATCH', 'publication-edition.update', Permission::UPDATE_DATA, PublicationEdition::class],
            ['DELETE', 'publication-edition.destroy', Permission::UPDATE_DATA, PublicationEdition::class],

            // PublicationDocument routes: every change is an update of the publication
            ['GET', 'publication.documents.index', Permission::VIEW_DATA, Publication::class],
            ['POST', 'publication.documents.store', Permission::UPDATE_DATA, Publication::class],
            ['GET', 'publication-document.show', Permission::VIEW_DATA, PublicationDocument::class],
            ['PATCH', 'publication-document.update', Permission::UPDATE_DATA, PublicationDocument::class],
            ['DELETE', 'publication-document.destroy', Permission::UPDATE_DATA, PublicationDocument::class],
            ['GET', 'publication-document.download', Permission::VIEW_DATA, PublicationDocument::class],

            // PublicationImage routes
            ['GET', 'publication-image.show', Permission::VIEW_DATA, PublicationImage::class],
            ['PATCH', 'publication-image.update', Permission::UPDATE_DATA, PublicationImage::class],
            ['DELETE', 'publication-image.destroy', Permission::DELETE_DATA, PublicationImage::class],
            ['POST', 'publication-image.detach', Permission::DELETE_DATA, PublicationImage::class],
            ['GET', 'publication-image.download', Permission::VIEW_DATA, PublicationImage::class],
            ['GET', 'publication-image.view', Permission::VIEW_DATA, PublicationImage::class],
            ['PATCH', 'publication-image.moveUp', Permission::UPDATE_DATA, PublicationImage::class],
            ['PATCH', 'publication-image.moveDown', Permission::UPDATE_DATA, PublicationImage::class],
            ['PATCH', 'publication-image.tightenOrdering', Permission::UPDATE_DATA, PublicationImage::class],

            // Tag routes
            ['GET', 'tag.index', Permission::VIEW_DATA, null],
            ['POST', 'tag.store', Permission::CREATE_DATA, null],
            ['GET', 'tag.forItem', Permission::VIEW_DATA, Item::class],
            ['GET', 'tag.show', Permission::VIEW_DATA, Tag::class],
            ['PATCH', 'tag.update', Permission::UPDATE_DATA, Tag::class],
            ['DELETE', 'tag.destroy', Permission::DELETE_DATA, Tag::class],
        ];
    }

    #[DataProvider('routePermissionsProvider')]
    public function test_route_enforces_correct_permission(
        string $method,
        string $route,
        Permission $requiredPermission,
        ?string $modelClass
    ): void {
        $routeParams = $this->getRouteParams($modelClass);

        $this->assertRouteRequiresPermission(
            $method,
            $route,
            $requiredPermission,
            $routeParams
        );
    }
}
