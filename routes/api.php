<?php

use App\Enums\Permission;
use App\Http\Controllers\Api\MarkdownController;
use App\Http\Controllers\AuthorController;
use App\Http\Controllers\AuthorTranslationController;
use App\Http\Controllers\AvailableImageController;
use App\Http\Controllers\CollectionController;
use App\Http\Controllers\CollectionImageController;
use App\Http\Controllers\CollectionMediaController;
use App\Http\Controllers\CollectionTranslationController;
use App\Http\Controllers\ContextController;
use App\Http\Controllers\ContributorController;
use App\Http\Controllers\ContributorImageController;
use App\Http\Controllers\ContributorTranslationController;
use App\Http\Controllers\CountryController;
use App\Http\Controllers\CountryTranslationController;
use App\Http\Controllers\DynastyController;
use App\Http\Controllers\DynastyTranslationController;
use App\Http\Controllers\GlossaryController;
use App\Http\Controllers\GlossarySpellingController;
use App\Http\Controllers\GlossaryTranslationController;
use App\Http\Controllers\ImageUploadController;
use App\Http\Controllers\InfoController;
use App\Http\Controllers\ItemController;
use App\Http\Controllers\ItemDocumentController;
use App\Http\Controllers\ItemImageController;
use App\Http\Controllers\ItemItemLinkController;
use App\Http\Controllers\ItemItemLinkTranslationController;
use App\Http\Controllers\ItemMediaController;
use App\Http\Controllers\ItemTranslationController;
use App\Http\Controllers\LanguageController;
use App\Http\Controllers\LanguageTranslationController;
use App\Http\Controllers\PartnerController;
use App\Http\Controllers\PartnerImageController;
use App\Http\Controllers\PartnerLogoController;
use App\Http\Controllers\PartnerTranslationController;
use App\Http\Controllers\PartnerTranslationImageController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\TagController;
use App\Http\Controllers\TimelineController;
use App\Http\Controllers\TimelineEventController;
use App\Http\Controllers\TimelineEventImageController;
use App\Http\Controllers\TimelineEventTranslationController;
use App\Http\Controllers\UserPermissionsController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Public info endpoints for monitoring and API information
Route::get('/info', [InfoController::class, 'index'])->name('info.index');
Route::get('/health', [InfoController::class, 'health'])->name('info.health');
Route::get('/version', [InfoController::class, 'version'])->name('info.version');

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::get('/user/permissions', [UserPermissionsController::class, 'index'])
    ->name('user.permissions')
    ->middleware('auth:sanctum');

// Data operation routes - require appropriate permissions based on HTTP method
Route::middleware(['auth:sanctum'])->group(function () {
    // READ operations - require VIEW_DATA permission
    Route::middleware(['permission:'.Permission::VIEW_DATA->value])->group(function () {
        // Context routes (read)
        Route::get('context/default', [ContextController::class, 'getDefault'])->name('context.getDefault');
        Route::get('context/{context}', [ContextController::class, 'show'])->name('context.show');
        Route::get('context', [ContextController::class, 'index'])->name('context.index');

        // Language routes (read)
        Route::get('language/default', [LanguageController::class, 'getDefault'])->name('language.getDefault');
        Route::get('language/english', [LanguageController::class, 'getEnglish'])->name('language.getEnglish');
        Route::get('language/{language}', [LanguageController::class, 'show'])->name('language.show');
        Route::get('language', [LanguageController::class, 'index'])->name('language.index');

        // Language Translation routes (read)
        Route::get('language-translation/{languageTranslation}', [LanguageTranslationController::class, 'show'])->name('language-translation.show');
        Route::get('language-translation', [LanguageTranslationController::class, 'index'])->name('language-translation.index');

        // Glossary routes (read)
        Route::get('glossary/{glossary}', [GlossaryController::class, 'show'])->name('glossary.show');
        Route::get('glossary', [GlossaryController::class, 'index'])->name('glossary.index');
        Route::get('glossary-translation/{glossaryTranslation}', [GlossaryTranslationController::class, 'show'])->name('glossary-translation.show');
        Route::get('glossary-translation', [GlossaryTranslationController::class, 'index'])->name('glossary-translation.index');
        Route::get('glossary-spelling/{glossarySpelling}', [GlossarySpellingController::class, 'show'])->name('glossary-spelling.show');
        Route::get('glossary-spelling', [GlossarySpellingController::class, 'index'])->name('glossary-spelling.index');

        // Project routes (read)
        Route::get('project/enabled', [ProjectController::class, 'enabled'])->name('project.enabled');
        Route::get('project/{project}', [ProjectController::class, 'show'])->name('project.show');
        Route::get('project', [ProjectController::class, 'index'])->name('project.index');

        // Country routes (read)
        Route::get('country/{country}', [CountryController::class, 'show'])->name('country.show');
        Route::get('country', [CountryController::class, 'index'])->name('country.index');

        // Country Translation routes (read)
        Route::get('country-translation/{countryTranslation}', [CountryTranslationController::class, 'show'])->name('country-translation.show');
        Route::get('country-translation', [CountryTranslationController::class, 'index'])->name('country-translation.index');

        // Tag routes (read)
        Route::get('tag/for-item/{item}', [TagController::class, 'forItem'])->name('tag.forItem');
        Route::get('tag/{tag}', [TagController::class, 'show'])->name('tag.show');
        Route::get('tag', [TagController::class, 'index'])->name('tag.index');

        // Dynasty routes (read)
        Route::get('dynasty/{dynasty}', [DynastyController::class, 'show'])->name('dynasty.show');
        Route::get('dynasty', [DynastyController::class, 'index'])->name('dynasty.index');

        // Dynasty Translation routes (read)
        Route::get('dynasty-translation/{dynastyTranslation}', [DynastyTranslationController::class, 'show'])->name('dynasty-translation.show');
        Route::get('dynasty-translation', [DynastyTranslationController::class, 'index'])->name('dynasty-translation.index');

        // Author routes (read)
        Route::get('author/{author}', [AuthorController::class, 'show'])->name('author.show');
        Route::get('author', [AuthorController::class, 'index'])->name('author.index');

        // Author Translation routes (read)
        Route::get('author-translation/{authorTranslation}', [AuthorTranslationController::class, 'show'])->name('author-translation.show');
        Route::get('author-translation', [AuthorTranslationController::class, 'index'])->name('author-translation.index');

        // Timeline routes (read)
        Route::get('timeline/{timeline}', [TimelineController::class, 'show'])->name('timeline.show');
        Route::get('timeline', [TimelineController::class, 'index'])->name('timeline.index');

        // Timeline Event routes (read)
        Route::get('timeline-event/{timelineEvent}', [TimelineEventController::class, 'show'])->name('timeline-event.show');
        Route::get('timeline-event', [TimelineEventController::class, 'index'])->name('timeline-event.index');

        // Timeline Event Translation routes (read)
        Route::get('timeline-event-translation/{timelineEventTranslation}', [TimelineEventTranslationController::class, 'show'])->name('timeline-event-translation.show');

        // Timeline Event Image routes (read)
        Route::get('timeline-event-image/{timelineEventImage}', [TimelineEventImageController::class, 'show'])->name('timeline-event-image.show');

        // Partner routes (read)
        Route::get('partner/{partner}', [PartnerController::class, 'show'])->name('partner.show');
        Route::get('partner', [PartnerController::class, 'index'])->name('partner.index');

        // Partner Translation routes (read)
        Route::get('partner-translation/{partnerTranslation}', [PartnerTranslationController::class, 'show'])->name('partner-translation.show');
        Route::get('partner-translation', [PartnerTranslationController::class, 'index'])->name('partner-translation.index');

        // Partner Image routes (read)
        Route::get('partner-image/{partnerImage}/download', [PartnerImageController::class, 'download'])->name('partner-image.download');
        Route::get('partner-image/{partnerImage}/view', [PartnerImageController::class, 'view'])->name('partner-image.view');
        Route::get('partner-image/{partnerImage}', [PartnerImageController::class, 'show'])->name('partner-image.show');
        Route::get('partner-image', [PartnerImageController::class, 'index'])->name('partner-image.index');

        // Partner Logo routes (read)
        Route::get('partner-logo/{partnerLogo}/download', [PartnerLogoController::class, 'download'])->name('partner-logo.download');
        Route::get('partner-logo/{partnerLogo}/view', [PartnerLogoController::class, 'view'])->name('partner-logo.view');
        Route::get('partner-logo/{partnerLogo}', [PartnerLogoController::class, 'show'])->name('partner-logo.show');
        Route::get('partner-logo', [PartnerLogoController::class, 'index'])->name('partner-logo.index');

        // Partner Translation Image routes (read)
        Route::get('partner-translation-image/{partnerTranslationImage}/download', [PartnerTranslationImageController::class, 'download'])->name('partner-translation-image.download');
        Route::get('partner-translation-image/{partnerTranslationImage}/view', [PartnerTranslationImageController::class, 'view'])->name('partner-translation-image.view');
        Route::get('partner-translation-image/{partnerTranslationImage}', [PartnerTranslationImageController::class, 'show'])->name('partner-translation-image.show');
        Route::get('partner-translation-image', [PartnerTranslationImageController::class, 'index'])->name('partner-translation-image.index');

        // Contributor routes (read)
        Route::get('contributor/{contributor}', [ContributorController::class, 'show'])->name('contributor.show');
        Route::get('contributor', [ContributorController::class, 'index'])->name('contributor.index');

        // Contributor Translation routes (read)
        Route::get('contributor-translation/{contributorTranslation}', [ContributorTranslationController::class, 'show'])->name('contributor-translation.show');
        Route::get('contributor-translation', [ContributorTranslationController::class, 'index'])->name('contributor-translation.index');

        // Contributor Image routes (read)
        Route::get('contributor-image/{contributorImage}/download', [ContributorImageController::class, 'download'])->name('contributor-image.download');
        Route::get('contributor-image/{contributorImage}/view', [ContributorImageController::class, 'view'])->name('contributor-image.view');
        Route::get('contributor-image/{contributorImage}', [ContributorImageController::class, 'show'])->name('contributor-image.show');
        Route::get('contributor-image', [ContributorImageController::class, 'index'])->name('contributor-image.index');

        // Item routes (read)
        Route::get('item/for-tag/{tag}', [ItemController::class, 'forTag'])->name('item.forTag');
        Route::post('item/with-all-tags', [ItemController::class, 'withAllTags'])->name('item.withAllTags');
        Route::post('item/with-any-tags', [ItemController::class, 'withAnyTags'])->name('item.withAnyTags');
        Route::get('item/type/{type}', [ItemController::class, 'byType'])->name('item.byType');
        Route::get('item/parents', [ItemController::class, 'parents'])->name('item.parents');
        Route::get('item/children', [ItemController::class, 'children'])->name('item.children');
        Route::get('item/{item}', [ItemController::class, 'show'])->name('item.show');
        Route::get('item', [ItemController::class, 'index'])->name('item.index');

        // ItemImage routes (read)
        Route::get('item/{item}/images', [ItemImageController::class, 'index'])->name('item.images.index');
        Route::get('item-image/{itemImage}/download', [ItemImageController::class, 'download'])->name('item-image.download');
        Route::get('item-image/{itemImage}/view', [ItemImageController::class, 'view'])->name('item-image.view');
        Route::get('item-image/{itemImage}', [ItemImageController::class, 'show'])->name('item-image.show');

        // ItemMedia routes (read)
        Route::get('item/{item}/media', [ItemMediaController::class, 'index'])->name('item.media.index');
        Route::get('item-media/{itemMedia}', [ItemMediaController::class, 'show'])->name('item-media.show');

        // ItemDocument routes (read)
        Route::get('item/{item}/documents', [ItemDocumentController::class, 'index'])->name('item.documents.index');
        Route::get('item-document/{itemDocument}/download', [ItemDocumentController::class, 'download'])->name('item-document.download');
        Route::get('item-document/{itemDocument}', [ItemDocumentController::class, 'show'])->name('item-document.show');

        // ItemItemLink routes (read)
        Route::get('item-item-link/{itemItemLink}', [ItemItemLinkController::class, 'show'])->name('item-item-link.show');
        Route::get('item-item-link', [ItemItemLinkController::class, 'index'])->name('item-item-link.index');

        // ItemItemLinkTranslation routes (read)
        Route::get('item-item-link-translation/{itemItemLinkTranslation}', [ItemItemLinkTranslationController::class, 'show'])->name('item-item-link-translation.show');
        Route::get('item-item-link-translation', [ItemItemLinkTranslationController::class, 'index'])->name('item-item-link-translation.index');

        // Image upload routes (read)
        Route::get('image-upload/{id}/status', [ImageUploadController::class, 'status'])->name('image-upload.status');
        Route::get('image-upload/{image_upload}', [ImageUploadController::class, 'show'])->name('image-upload.show');
        Route::get('image-upload', [ImageUploadController::class, 'index'])->name('image-upload.index');

        // Available image routes (read)
        Route::get('available-image/{available_image}/download', [AvailableImageController::class, 'download'])->name('available-image.download');
        Route::get('available-image/{available_image}/view', [AvailableImageController::class, 'view'])->name('available-image.view');
        Route::get('available-image/{available_image}', [AvailableImageController::class, 'show'])->name('available-image.show');
        Route::get('available-image', [AvailableImageController::class, 'index'])->name('available-image.index');

        // Translation routes (read)
        Route::get('item-translation/{item_translation}', [ItemTranslationController::class, 'show'])->name('item-translation.show');
        Route::get('item-translation', [ItemTranslationController::class, 'index'])->name('item-translation.index');
        Route::get('collection-translation/{collection_translation}', [CollectionTranslationController::class, 'show'])->name('collection-translation.show');
        Route::get('collection-translation', [CollectionTranslationController::class, 'index'])->name('collection-translation.index');

        // Collection routes (read)
        Route::get('collection/type/{type}', [CollectionController::class, 'byType'])->name('collection.byType');
        Route::get('collection/{collection}', [CollectionController::class, 'show'])->name('collection.show');
        Route::get('collection', [CollectionController::class, 'index'])->name('collection.index');

        // CollectionImage routes (read)
        Route::get('collection/{collection}/images', [CollectionImageController::class, 'index'])->name('collection.images.index');
        Route::get('collection-image/{collectionImage}/download', [CollectionImageController::class, 'download'])->name('collection-image.download');
        Route::get('collection-image/{collectionImage}/view', [CollectionImageController::class, 'view'])->name('collection-image.view');
        Route::get('collection-image/{collectionImage}', [CollectionImageController::class, 'show'])->name('collection-image.show');

        // CollectionMedia routes (read)
        Route::get('collection/{collection}/media', [CollectionMediaController::class, 'index'])->name('collection.media.index');
        Route::get('collection-media/{collectionMedia}', [CollectionMediaController::class, 'show'])->name('collection-media.show');

    });

    // CREATE operations - require CREATE_DATA permission
    Route::middleware(['permission:'.Permission::CREATE_DATA->value])->group(function () {
        Route::post('context', [ContextController::class, 'store'])->name('context.store');
        Route::post('language', [LanguageController::class, 'store'])->name('language.store');
        Route::post('language-translation', [LanguageTranslationController::class, 'store'])->name('language-translation.store');
        Route::post('glossary', [GlossaryController::class, 'store'])->name('glossary.store');
        Route::post('glossary/{glossary}/attach-synonym', [GlossaryController::class, 'attachSynonym'])->name('glossary.attachSynonym');
        Route::post('glossary-translation', [GlossaryTranslationController::class, 'store'])->name('glossary-translation.store');
        Route::post('glossary-spelling', [GlossarySpellingController::class, 'store'])->name('glossary-spelling.store');
        Route::post('country', [CountryController::class, 'store'])->name('country.store');
        Route::post('country-translation', [CountryTranslationController::class, 'store'])->name('country-translation.store');
        Route::post('tag', [TagController::class, 'store'])->name('tag.store');
        Route::post('dynasty', [DynastyController::class, 'store'])->name('dynasty.store');
        Route::post('dynasty-translation', [DynastyTranslationController::class, 'store'])->name('dynasty-translation.store');
        Route::post('author', [AuthorController::class, 'store'])->name('author.store');
        Route::post('author-translation', [AuthorTranslationController::class, 'store'])->name('author-translation.store');
        Route::post('timeline', [TimelineController::class, 'store'])->name('timeline.store');
        Route::post('timeline-event', [TimelineEventController::class, 'store'])->name('timeline-event.store');
        Route::post('timeline-event-translation', [TimelineEventTranslationController::class, 'store'])->name('timeline-event-translation.store');
        Route::post('partner', [PartnerController::class, 'store'])->name('partner.store');
        Route::post('partner/{partner}/attach-image', [PartnerImageController::class, 'attachFromAvailable'])->name('partner.attachImage');
        Route::post('partner-translation', [PartnerTranslationController::class, 'store'])->name('partner-translation.store');
        Route::post('partner-translation/{partnerTranslation}/attach-image', [PartnerTranslationImageController::class, 'attachFromAvailable'])->name('partner-translation.attachImage');
        Route::post('partner-image', [PartnerImageController::class, 'store'])->name('partner-image.store');
        Route::post('partner-logo', [PartnerLogoController::class, 'store'])->name('partner-logo.store');
        Route::post('partner-translation-image', [PartnerTranslationImageController::class, 'store'])->name('partner-translation-image.store');
        Route::post('contributor', [ContributorController::class, 'store'])->name('contributor.store');
        Route::post('contributor/{contributor}/attach-image', [ContributorImageController::class, 'attachFromAvailable'])->name('contributor.attachImage');
        Route::post('contributor-translation', [ContributorTranslationController::class, 'store'])->name('contributor-translation.store');
        Route::post('contributor-image', [ContributorImageController::class, 'store'])->name('contributor-image.store');
        Route::post('item', [ItemController::class, 'store'])->name('item.store');
        Route::post('item/{item}/images', [ItemImageController::class, 'store'])->name('item.images.store');
        Route::post('item/{item}/attach-image', [ItemImageController::class, 'attachFromAvailable'])->name('item.attachImage');
        Route::post('item/{item}/media', [ItemMediaController::class, 'store'])->name('item.media.store');
        Route::post('item/{item}/documents', [ItemDocumentController::class, 'store'])->name('item.documents.store');
        Route::post('item/{item}/attach-tag', [ItemController::class, 'attachTag'])->name('item.attachTag');
        Route::post('item/{item}/attach-tags', [ItemController::class, 'attachTags'])->name('item.attachTags');
        Route::post('item-item-link', [ItemItemLinkController::class, 'store'])->name('item-item-link.store');
        Route::post('item-item-link-translation', [ItemItemLinkTranslationController::class, 'store'])->name('item-item-link-translation.store');
        Route::post('project', [ProjectController::class, 'store'])->name('project.store');
        Route::post('image-upload', [ImageUploadController::class, 'store'])->name('image-upload.store');
        Route::post('item-translation', [ItemTranslationController::class, 'store'])->name('item-translation.store');
        Route::post('collection-translation', [CollectionTranslationController::class, 'store'])->name('collection-translation.store');
        Route::post('collection', [CollectionController::class, 'store'])->name('collection.store');
        Route::post('collection/{collection}/attach-item', [CollectionController::class, 'attachItem'])->name('collection.attachItem');
        Route::post('collection/{collection}/attach-items', [CollectionController::class, 'attachItems'])->name('collection.attachItems');
        Route::post('collection/{collection}/images', [CollectionImageController::class, 'store'])->name('collection.images.store');
        Route::post('collection/{collection}/attach-image', [CollectionImageController::class, 'attachFromAvailable'])->name('collection.attachImage');
        Route::post('collection/{collection}/media', [CollectionMediaController::class, 'store'])->name('collection.media.store');
    });

    // UPDATE operations - require UPDATE_DATA permission
    Route::middleware(['permission:'.Permission::UPDATE_DATA->value])->group(function () {
        Route::patch('context/{context}/default', [ContextController::class, 'setDefault'])->name('context.setDefault');
        Route::delete('context/default', [ContextController::class, 'clearDefault'])->name('context.clearDefault');
        Route::patch('context/{context}', [ContextController::class, 'update'])->name('context.update');
        Route::put('context/{context}', [ContextController::class, 'update']);

        Route::patch('language/{language}/default', [LanguageController::class, 'setDefault'])->name('language.setDefault');
        Route::delete('language/default', [LanguageController::class, 'clearDefault'])->name('language.clearDefault');
        Route::patch('language/{language}', [LanguageController::class, 'update'])->name('language.update');
        Route::put('language/{language}', [LanguageController::class, 'update']);

        Route::patch('language-translation/{languageTranslation}', [LanguageTranslationController::class, 'update'])->name('language-translation.update');
        Route::put('language-translation/{languageTranslation}', [LanguageTranslationController::class, 'update']);

        Route::patch('glossary/{glossary}', [GlossaryController::class, 'update'])->name('glossary.update');
        Route::put('glossary/{glossary}', [GlossaryController::class, 'update']);

        Route::patch('glossary-translation/{glossaryTranslation}', [GlossaryTranslationController::class, 'update'])->name('glossary-translation.update');
        Route::put('glossary-translation/{glossaryTranslation}', [GlossaryTranslationController::class, 'update']);

        Route::patch('glossary-spelling/{glossarySpelling}', [GlossarySpellingController::class, 'update'])->name('glossary-spelling.update');
        Route::put('glossary-spelling/{glossarySpelling}', [GlossarySpellingController::class, 'update']);

        Route::patch('project/{project}/launched', [ProjectController::class, 'setLaunched'])->name('project.setLaunched');
        Route::patch('project/{project}/enabled', [ProjectController::class, 'setEnabled'])->name('project.setEnabled');
        Route::patch('project/{project}', [ProjectController::class, 'update'])->name('project.update');
        Route::put('project/{project}', [ProjectController::class, 'update']);

        Route::patch('country/{country}', [CountryController::class, 'update'])->name('country.update');
        Route::put('country/{country}', [CountryController::class, 'update']);

        Route::patch('country-translation/{countryTranslation}', [CountryTranslationController::class, 'update'])->name('country-translation.update');
        Route::put('country-translation/{countryTranslation}', [CountryTranslationController::class, 'update']);

        Route::patch('tag/{tag}', [TagController::class, 'update'])->name('tag.update');
        Route::put('tag/{tag}', [TagController::class, 'update']);

        Route::patch('dynasty/{dynasty}', [DynastyController::class, 'update'])->name('dynasty.update');
        Route::put('dynasty/{dynasty}', [DynastyController::class, 'update']);

        Route::patch('dynasty-translation/{dynastyTranslation}', [DynastyTranslationController::class, 'update'])->name('dynasty-translation.update');
        Route::put('dynasty-translation/{dynastyTranslation}', [DynastyTranslationController::class, 'update']);

        Route::patch('author/{author}', [AuthorController::class, 'update'])->name('author.update');
        Route::put('author/{author}', [AuthorController::class, 'update']);

        Route::patch('author-translation/{authorTranslation}', [AuthorTranslationController::class, 'update'])->name('author-translation.update');
        Route::put('author-translation/{authorTranslation}', [AuthorTranslationController::class, 'update']);

        Route::patch('timeline/{timeline}', [TimelineController::class, 'update'])->name('timeline.update');
        Route::put('timeline/{timeline}', [TimelineController::class, 'update']);

        Route::patch('timeline-event/{timelineEvent}', [TimelineEventController::class, 'update'])->name('timeline-event.update');
        Route::put('timeline-event/{timelineEvent}', [TimelineEventController::class, 'update']);

        Route::patch('timeline-event-translation/{timelineEventTranslation}', [TimelineEventTranslationController::class, 'update'])->name('timeline-event-translation.update');
        Route::put('timeline-event-translation/{timelineEventTranslation}', [TimelineEventTranslationController::class, 'update']);

        Route::patch('timeline-event-image/{timelineEventImage}', [TimelineEventImageController::class, 'update'])->name('timeline-event-image.update');
        Route::put('timeline-event-image/{timelineEventImage}', [TimelineEventImageController::class, 'update']);
        Route::patch('timeline-event-image/{timelineEventImage}/move-up', [TimelineEventImageController::class, 'moveUp'])->name('timeline-event-image.moveUp');
        Route::patch('timeline-event-image/{timelineEventImage}/move-down', [TimelineEventImageController::class, 'moveDown'])->name('timeline-event-image.moveDown');

        Route::patch('partner/{partner}', [PartnerController::class, 'update'])->name('partner.update');
        Route::put('partner/{partner}', [PartnerController::class, 'update']);

        Route::patch('partner-translation/{partnerTranslation}', [PartnerTranslationController::class, 'update'])->name('partner-translation.update');
        Route::put('partner-translation/{partnerTranslation}', [PartnerTranslationController::class, 'update']);

        Route::patch('partner-image/{partnerImage}', [PartnerImageController::class, 'update'])->name('partner-image.update');
        Route::put('partner-image/{partnerImage}', [PartnerImageController::class, 'update']);
        Route::patch('partner-image/{partnerImage}/move-up', [PartnerImageController::class, 'moveUp'])->name('partner-image.moveUp');
        Route::patch('partner-image/{partnerImage}/move-down', [PartnerImageController::class, 'moveDown'])->name('partner-image.moveDown');
        Route::patch('partner-image/{partnerImage}/tighten-ordering', [PartnerImageController::class, 'tightenOrdering'])->name('partner-image.tightenOrdering');

        Route::patch('partner-logo/{partnerLogo}', [PartnerLogoController::class, 'update'])->name('partner-logo.update');
        Route::put('partner-logo/{partnerLogo}', [PartnerLogoController::class, 'update']);
        Route::patch('partner-logo/{partnerLogo}/move-up', [PartnerLogoController::class, 'moveUp'])->name('partner-logo.moveUp');
        Route::patch('partner-logo/{partnerLogo}/move-down', [PartnerLogoController::class, 'moveDown'])->name('partner-logo.moveDown');
        Route::patch('partner-logo/{partnerLogo}/tighten-ordering', [PartnerLogoController::class, 'tightenOrdering'])->name('partner-logo.tightenOrdering');

        Route::patch('partner-translation-image/{partnerTranslationImage}', [PartnerTranslationImageController::class, 'update'])->name('partner-translation-image.update');
        Route::put('partner-translation-image/{partnerTranslationImage}', [PartnerTranslationImageController::class, 'update']);
        Route::patch('partner-translation-image/{partnerTranslationImage}/move-up', [PartnerTranslationImageController::class, 'moveUp'])->name('partner-translation-image.moveUp');
        Route::patch('partner-translation-image/{partnerTranslationImage}/move-down', [PartnerTranslationImageController::class, 'moveDown'])->name('partner-translation-image.moveDown');
        Route::patch('partner-translation-image/{partnerTranslationImage}/tighten-ordering', [PartnerTranslationImageController::class, 'tightenOrdering'])->name('partner-translation-image.tightenOrdering');

        Route::patch('item/{item}/tags', [ItemController::class, 'updateTags'])->name('item.updateTags');
        Route::patch('item/{item}', [ItemController::class, 'update'])->name('item.update');
        Route::put('item/{item}', [ItemController::class, 'update']);

        Route::patch('item-image/{itemImage}', [ItemImageController::class, 'update'])->name('item-image.update');
        Route::put('item-image/{itemImage}', [ItemImageController::class, 'update']);
        Route::patch('item-image/{itemImage}/move-up', [ItemImageController::class, 'moveUp'])->name('item-image.moveUp');
        Route::patch('item-image/{itemImage}/move-down', [ItemImageController::class, 'moveDown'])->name('item-image.moveDown');
        Route::patch('item-image/{itemImage}/tighten-ordering', [ItemImageController::class, 'tightenOrdering'])->name('item-image.tightenOrdering');

        Route::patch('item-media/{itemMedia}', [ItemMediaController::class, 'update'])->name('item-media.update');
        Route::put('item-media/{itemMedia}', [ItemMediaController::class, 'update']);
        Route::patch('item-media/{itemMedia}/move-up', [ItemMediaController::class, 'moveUp'])->name('item-media.moveUp');
        Route::patch('item-media/{itemMedia}/move-down', [ItemMediaController::class, 'moveDown'])->name('item-media.moveDown');

        Route::patch('item-document/{itemDocument}', [ItemDocumentController::class, 'update'])->name('item-document.update');
        Route::put('item-document/{itemDocument}', [ItemDocumentController::class, 'update']);
        Route::patch('item-document/{itemDocument}/move-up', [ItemDocumentController::class, 'moveUp'])->name('item-document.moveUp');
        Route::patch('item-document/{itemDocument}/move-down', [ItemDocumentController::class, 'moveDown'])->name('item-document.moveDown');

        Route::patch('item-item-link/{itemItemLink}', [ItemItemLinkController::class, 'update'])->name('item-item-link.update');
        Route::put('item-item-link/{itemItemLink}', [ItemItemLinkController::class, 'update']);

        Route::patch('item-item-link-translation/{itemItemLinkTranslation}', [ItemItemLinkTranslationController::class, 'update'])->name('item-item-link-translation.update');
        Route::put('item-item-link-translation/{itemItemLinkTranslation}', [ItemItemLinkTranslationController::class, 'update']);

        Route::patch('collection-image/{collectionImage}', [CollectionImageController::class, 'update'])->name('collection-image.update');
        Route::put('collection-image/{collectionImage}', [CollectionImageController::class, 'update']);
        Route::patch('collection-image/{collectionImage}/move-up', [CollectionImageController::class, 'moveUp'])->name('collection-image.moveUp');
        Route::patch('collection-image/{collectionImage}/move-down', [CollectionImageController::class, 'moveDown'])->name('collection-image.moveDown');
        Route::patch('collection-image/{collectionImage}/tighten-ordering', [CollectionImageController::class, 'tightenOrdering'])->name('collection-image.tightenOrdering');

        Route::patch('collection-media/{collectionMedia}', [CollectionMediaController::class, 'update'])->name('collection-media.update');
        Route::put('collection-media/{collectionMedia}', [CollectionMediaController::class, 'update']);
        Route::patch('collection-media/{collectionMedia}/move-up', [CollectionMediaController::class, 'moveUp'])->name('collection-media.moveUp');
        Route::patch('collection-media/{collectionMedia}/move-down', [CollectionMediaController::class, 'moveDown'])->name('collection-media.moveDown');

        Route::patch('contributor/{contributor}', [ContributorController::class, 'update'])->name('contributor.update');
        Route::put('contributor/{contributor}', [ContributorController::class, 'update']);

        Route::patch('contributor-translation/{contributorTranslation}', [ContributorTranslationController::class, 'update'])->name('contributor-translation.update');
        Route::put('contributor-translation/{contributorTranslation}', [ContributorTranslationController::class, 'update']);

        Route::patch('contributor-image/{contributorImage}', [ContributorImageController::class, 'update'])->name('contributor-image.update');
        Route::put('contributor-image/{contributorImage}', [ContributorImageController::class, 'update']);
        Route::patch('contributor-image/{contributorImage}/move-up', [ContributorImageController::class, 'moveUp'])->name('contributor-image.moveUp');
        Route::patch('contributor-image/{contributorImage}/move-down', [ContributorImageController::class, 'moveDown'])->name('contributor-image.moveDown');
        Route::patch('contributor-image/{contributorImage}/tighten-ordering', [ContributorImageController::class, 'tightenOrdering'])->name('contributor-image.tightenOrdering');

        Route::patch('item-translation/{item_translation}', [ItemTranslationController::class, 'update'])->name('item-translation.update');
        Route::put('item-translation/{item_translation}', [ItemTranslationController::class, 'update']);

        Route::patch('collection-translation/{collection_translation}', [CollectionTranslationController::class, 'update'])->name('collection-translation.update');
        Route::put('collection-translation/{collection_translation}', [CollectionTranslationController::class, 'update']);

        Route::patch('collection/{collection}', [CollectionController::class, 'update'])->name('collection.update');
        Route::put('collection/{collection}', [CollectionController::class, 'update']);
    });

    // DELETE operations - require DELETE_DATA permission
    Route::middleware(['permission:'.Permission::DELETE_DATA->value])->group(function () {
        Route::delete('context/{context}', [ContextController::class, 'destroy'])->name('context.destroy');
        Route::delete('language/{language}', [LanguageController::class, 'destroy'])->name('language.destroy');
        Route::delete('language-translation/{languageTranslation}', [LanguageTranslationController::class, 'destroy'])->name('language-translation.destroy');
        Route::delete('glossary/{glossary}', [GlossaryController::class, 'destroy'])->name('glossary.destroy');
        Route::delete('glossary/{glossary}/detach-synonym', [GlossaryController::class, 'detachSynonym'])->name('glossary.detachSynonym');
        Route::delete('glossary-translation/{glossaryTranslation}', [GlossaryTranslationController::class, 'destroy'])->name('glossary-translation.destroy');
        Route::delete('glossary-spelling/{glossarySpelling}', [GlossarySpellingController::class, 'destroy'])->name('glossary-spelling.destroy');
        Route::delete('country/{country}', [CountryController::class, 'destroy'])->name('country.destroy');
        Route::delete('country-translation/{countryTranslation}', [CountryTranslationController::class, 'destroy'])->name('country-translation.destroy');
        Route::delete('tag/{tag}', [TagController::class, 'destroy'])->name('tag.destroy');
        Route::delete('dynasty/{dynasty}', [DynastyController::class, 'destroy'])->name('dynasty.destroy');
        Route::delete('dynasty-translation/{dynastyTranslation}', [DynastyTranslationController::class, 'destroy'])->name('dynasty-translation.destroy');
        Route::delete('author/{author}', [AuthorController::class, 'destroy'])->name('author.destroy');
        Route::delete('author-translation/{authorTranslation}', [AuthorTranslationController::class, 'destroy'])->name('author-translation.destroy');
        Route::delete('timeline/{timeline}', [TimelineController::class, 'destroy'])->name('timeline.destroy');
        Route::delete('timeline-event/{timelineEvent}', [TimelineEventController::class, 'destroy'])->name('timeline-event.destroy');
        Route::delete('timeline-event-translation/{timelineEventTranslation}', [TimelineEventTranslationController::class, 'destroy'])->name('timeline-event-translation.destroy');
        Route::delete('timeline-event-image/{timelineEventImage}', [TimelineEventImageController::class, 'destroy'])->name('timeline-event-image.destroy');
        Route::delete('partner/{partner}', [PartnerController::class, 'destroy'])->name('partner.destroy');
        Route::delete('partner-translation/{partnerTranslation}', [PartnerTranslationController::class, 'destroy'])->name('partner-translation.destroy');
        Route::delete('partner-image/{partnerImage}', [PartnerImageController::class, 'destroy'])->name('partner-image.destroy');
        Route::post('partner-image/{partnerImage}/detach', [PartnerImageController::class, 'detachToAvailable'])->name('partner-image.detach');
        Route::delete('partner-logo/{partnerLogo}', [PartnerLogoController::class, 'destroy'])->name('partner-logo.destroy');
        Route::delete('partner-translation-image/{partnerTranslationImage}', [PartnerTranslationImageController::class, 'destroy'])->name('partner-translation-image.destroy');
        Route::post('partner-translation-image/{partnerTranslationImage}/detach', [PartnerTranslationImageController::class, 'detachToAvailable'])->name('partner-translation-image.detach');
        Route::delete('item/{item}', [ItemController::class, 'destroy'])->name('item.destroy');
        Route::delete('item/{item}/detach-tag', [ItemController::class, 'detachTag'])->name('item.detachTag');
        Route::delete('item/{item}/detach-tags', [ItemController::class, 'detachTags'])->name('item.detachTags');
        Route::delete('item-image/{itemImage}', [ItemImageController::class, 'destroy'])->name('item-image.destroy');
        Route::post('item-image/{itemImage}/detach', [ItemImageController::class, 'detachToAvailable'])->name('item-image.detach');
        Route::delete('item-media/{itemMedia}', [ItemMediaController::class, 'destroy'])->name('item-media.destroy');
        Route::delete('item-document/{itemDocument}', [ItemDocumentController::class, 'destroy'])->name('item-document.destroy');
        Route::delete('item-item-link/{itemItemLink}', [ItemItemLinkController::class, 'destroy'])->name('item-item-link.destroy');
        Route::delete('item-item-link-translation/{itemItemLinkTranslation}', [ItemItemLinkTranslationController::class, 'destroy'])->name('item-item-link-translation.destroy');
        Route::delete('collection-image/{collectionImage}', [CollectionImageController::class, 'destroy'])->name('collection-image.destroy');
        Route::post('collection-image/{collectionImage}/detach', [CollectionImageController::class, 'detachToAvailable'])->name('collection-image.detach');
        Route::delete('collection-media/{collectionMedia}', [CollectionMediaController::class, 'destroy'])->name('collection-media.destroy');
        Route::delete('project/{project}', [ProjectController::class, 'destroy'])->name('project.destroy');
        Route::delete('image-upload/{image_upload}', [ImageUploadController::class, 'destroy'])->name('image-upload.destroy');
        Route::delete('available-image/{available_image}', [AvailableImageController::class, 'destroy'])->name('available-image.destroy');
        Route::patch('available-image/{available_image}', [AvailableImageController::class, 'update'])->name('available-image.update');
        Route::put('available-image/{available_image}', [AvailableImageController::class, 'update']);
        Route::delete('item-translation/{item_translation}', [ItemTranslationController::class, 'destroy'])->name('item-translation.destroy');
        Route::delete('collection-translation/{collection_translation}', [CollectionTranslationController::class, 'destroy'])->name('collection-translation.destroy');
        Route::delete('collection/{collection}', [CollectionController::class, 'destroy'])->name('collection.destroy');
        Route::delete('collection/{collection}/detach-item', [CollectionController::class, 'detachItem'])->name('collection.detachItem');
        Route::delete('collection/{collection}/detach-items', [CollectionController::class, 'detachItems'])->name('collection.detachItems');
        Route::delete('contributor/{contributor}', [ContributorController::class, 'destroy'])->name('contributor.destroy');
        Route::delete('contributor-translation/{contributorTranslation}', [ContributorTranslationController::class, 'destroy'])->name('contributor-translation.destroy');
        Route::delete('contributor-image/{contributorImage}', [ContributorImageController::class, 'destroy'])->name('contributor-image.destroy');
        Route::post('contributor-image/{contributorImage}/detach', [ContributorImageController::class, 'detachToAvailable'])->name('contributor-image.detach');
    });
});

// Markdown conversion routes - utility endpoints (no auth required)
// These are stateless utility functions that don't access user data
Route::prefix('markdown')->group(function () {
    Route::post('to-html', [MarkdownController::class, 'markdownToHtml'])
        ->name('markdown.toHtml');

    Route::post('from-html', [MarkdownController::class, 'htmlToMarkdown'])
        ->name('markdown.fromHtml');

    Route::post('validate', [MarkdownController::class, 'validateMarkdown'])
        ->name('markdown.validate');

    Route::post('preview', [MarkdownController::class, 'previewMarkdown'])
        ->name('markdown.preview');

    Route::post('is-markdown', [MarkdownController::class, 'isMarkdown'])
        ->name('markdown.isMarkdown');

    Route::get('allowed-elements', [MarkdownController::class, 'getAllowedElements'])
        ->name('markdown.allowedElements');
});
