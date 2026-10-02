<?php

namespace App\Providers;

use App\Events\CollectionTranslationSaved;
use App\Events\ItemTranslationSaved;
use App\Events\SpellingSaved;
use App\Events\TimelineEventTranslationSaved;
use App\Http\Controllers\Pub\PictureController;
use App\Listeners\DispatchSyncCollectionTranslationSpellings;
use App\Listeners\DispatchSyncItemTranslationSpellings;
use App\Listeners\DispatchSyncSpellingToCollectionTranslations;
use App\Listeners\DispatchSyncSpellingToItemTranslations;
use App\Listeners\DispatchSyncSpellingToTimelineEventTranslations;
use App\Listeners\DispatchSyncTimelineEventTranslationSpellings;
use App\Models\ItemItemLink;
use App\Models\ItemItemLinkTranslation;
use App\Models\Timeline;
use App\Models\TimelineEvent;
use App\Models\User;
use App\Policies\ItemItemLinkPolicy;
use App\Policies\ItemItemLinkTranslationPolicy;
use App\Policies\RolePolicy;
use App\Policies\TimelineEventPolicy;
use App\Policies\TimelinePolicy;
use App\Policies\UserPolicy;
use App\Support\Documentation\RuleTransformers\IncludeRuleTransformer;
use Dedoc\Scramble\Scramble;
use Dedoc\Scramble\Support\Generator\OpenApi;
use Dedoc\Scramble\Support\Generator\SecurityScheme;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
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

        // Register glossary link maintenance event listeners
        Event::listen(ItemTranslationSaved::class, DispatchSyncItemTranslationSpellings::class);
        Event::listen(CollectionTranslationSaved::class, DispatchSyncCollectionTranslationSpellings::class);
        Event::listen(TimelineEventTranslationSaved::class, DispatchSyncTimelineEventTranslationSpellings::class);
        Event::listen(SpellingSaved::class, DispatchSyncSpellingToItemTranslations::class);
        Event::listen(SpellingSaved::class, DispatchSyncSpellingToCollectionTranslations::class);
        Event::listen(SpellingSaved::class, DispatchSyncSpellingToTimelineEventTranslations::class);

        // Define a Gate for API documentation access
        Gate::define('viewApiDocs', function ($user = null) {
            // Allow authenticated users to view API docs
            return $user !== null;
        });

        Gate::policy(User::class, UserPolicy::class);
        Gate::policy(Role::class, RolePolicy::class);
        Gate::policy(ItemItemLink::class, ItemItemLinkPolicy::class);
        Gate::policy(ItemItemLinkTranslation::class, ItemItemLinkTranslationPolicy::class);
        Gate::policy(Timeline::class, TimelinePolicy::class);
        Gate::policy(TimelineEvent::class, TimelineEventPolicy::class);

        // Register Scramble rule transformers for automatic API documentation
        Scramble::configure()
            ->withRuleTransformers([
                IncludeRuleTransformer::class,
            ]);

        Scramble::afterOpenApiGenerated(function (OpenApi $openApi) {
            /** @var SecurityScheme $scheme */
            $scheme = SecurityScheme::http('bearer');
            $openApi->secure($scheme);
        });
    }
}
