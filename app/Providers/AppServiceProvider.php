<?php

namespace App\Providers;

use App\Enums\OAuthScope;
use App\Events\CollectionTranslationSaved;
use App\Events\DynastyTranslationSaved;
use App\Events\ItemTranslationSaved;
use App\Events\SpellingSaved;
use App\Events\TimelineEventTranslationSaved;
use App\Http\Controllers\Doc\DocumentController;
use App\Http\Controllers\Pub\PictureController;
use App\Listeners\DispatchSyncCollectionTranslationSpellings;
use App\Listeners\DispatchSyncDynastyTranslationSpellings;
use App\Listeners\DispatchSyncItemTranslationSpellings;
use App\Listeners\DispatchSyncSpellingToCollectionTranslations;
use App\Listeners\DispatchSyncSpellingToDynastyTranslations;
use App\Listeners\DispatchSyncSpellingToItemTranslations;
use App\Listeners\DispatchSyncSpellingToTimelineEventTranslations;
use App\Listeners\DispatchSyncTimelineEventTranslationSpellings;
use App\Models\ItemItemLink;
use App\Models\ItemItemLinkTranslation;
use App\Models\Link;
use App\Models\Timeline;
use App\Models\TimelineEvent;
use App\Models\User;
use App\Observers\UserAuditObserver;
use App\Policies\ItemItemLinkPolicy;
use App\Policies\ItemItemLinkTranslationPolicy;
use App\Policies\PermissionPolicy;
use App\Policies\RolePolicy;
use App\Policies\TimelineEventPolicy;
use App\Policies\TimelinePolicy;
use App\Policies\UserPolicy;
use App\Support\Documentation\RuleTransformers\IncludeRuleTransformer;
use App\Support\Images\AttachedImageRegistry;
use Dedoc\Scramble\Scramble;
use Dedoc\Scramble\Support\Generator\OpenApi;
use Dedoc\Scramble\Support\Generator\SecurityScheme;
use Dedoc\Scramble\Support\Generator\SecuritySchemes\OAuthFlow;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Resources\Resource;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Symfony\Component\HttpFoundation\Response;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // An image's texts (ImageTranslation, M16 F2) name their image, and a Link
        // (M16 F3) its owner, by a short, stable alias rather than a class name,
        // so renaming a model never orphans them.
        Relation::morphMap([...Link::OWNERS, ...AttachedImageRegistry::morphAliases()]);

        // Public picture endpoint throttle — configurable via PUB_PICTURES_THROTTLE env var.
        // Counts the requests that cost something: a burn, or an error such as
        // an unknown filename. A 304 or a cache hit is the cheap path a page full
        // of pictures is made of, and costs nothing here; a partner logo is
        // never burned, so it never counts either. Once an address has used its
        // budget, every request it makes waits for the minute to end
        RateLimiter::for('pub-pictures', function (Request $request) {
            return Limit::perMinute(Config::integer('app.pub_pictures_throttle'))
                ->by($request->ip())
                ->after(fn (Response $response): bool => $response->getStatusCode() >= 400
                    || $request->attributes->getBoolean(PictureController::BURNED));
        });

        // Public document endpoint throttle (/doc), configurable via
        // DOC_DOCUMENTS_THROTTLE. Counts a served file or an error; a 304 is
        // the cheap revalidation and costs nothing here
        RateLimiter::for('doc-documents', function (Request $request) {
            return Limit::perMinute(Config::integer('app.doc_documents_throttle'))
                ->by($request->ip())
                ->after(fn (Response $response): bool => $response->getStatusCode() >= 400
                    || $request->attributes->getBoolean(DocumentController::SERVED));
        });

        // Register glossary link maintenance event listeners
        Event::listen(ItemTranslationSaved::class, DispatchSyncItemTranslationSpellings::class);
        Event::listen(CollectionTranslationSaved::class, DispatchSyncCollectionTranslationSpellings::class);
        Event::listen(TimelineEventTranslationSaved::class, DispatchSyncTimelineEventTranslationSpellings::class);
        Event::listen(DynastyTranslationSaved::class, DispatchSyncDynastyTranslationSpellings::class);
        Event::listen(SpellingSaved::class, DispatchSyncSpellingToItemTranslations::class);
        Event::listen(SpellingSaved::class, DispatchSyncSpellingToCollectionTranslations::class);
        Event::listen(SpellingSaved::class, DispatchSyncSpellingToTimelineEventTranslations::class);
        Event::listen(SpellingSaved::class, DispatchSyncSpellingToDynastyTranslations::class);

        // Define a Gate for API documentation access
        Gate::define('viewApiDocs', function ($user = null) {
            // Allow authenticated users to view API docs
            return $user !== null;
        });

        // Account changes go to the audit log, and suspending a user revokes
        // their sessions and tokens (UserAuditObserver). Role changes and the
        // account commands reach it through App\Listeners\Audit\*, which
        // Laravel's event discovery registers from their handle() type
        User::observe(UserAuditObserver::class);

        // The policies are the only authorization mechanism, on the panel,
        // the API and the MCP server alike. Filament allows an action on a
        // model with no policy by default; here a missing policy denies,
        // exactly as the Gate does everywhere else
        Resource::checkPolicyExistence(false);
        RelationManager::checkPolicyExistence(false);

        Gate::policy(User::class, UserPolicy::class);
        Gate::policy(Role::class, RolePolicy::class);
        Gate::policy(Permission::class, PermissionPolicy::class);
        Gate::policy(ItemItemLink::class, ItemItemLinkPolicy::class);
        Gate::policy(ItemItemLinkTranslation::class, ItemItemLinkTranslationPolicy::class);
        Gate::policy(Timeline::class, TimelinePolicy::class);
        Gate::policy(TimelineEvent::class, TimelineEventPolicy::class);

        // Register Scramble rule transformers for automatic API documentation
        Scramble::configure()
            ->withRuleTransformers([
                IncludeRuleTransformer::class,
            ]);

        // The API accepts only OAuth tokens from the authorization-code flow
        Scramble::afterOpenApiGenerated(function (OpenApi $openApi) {
            $scheme = SecurityScheme::oauth2()->flow('authorizationCode', function (OAuthFlow $flow): void {
                $flow->authorizationUrl(route('passport.authorizations.authorize'))
                    ->tokenUrl(route('passport.token'))
                    ->refreshUrl(route('passport.token'));

                foreach (OAuthScope::descriptions() as $scope => $description) {
                    $flow->addScope($scope, $description);
                }
            });
            $openApi->secure($scheme);
        });
    }
}
