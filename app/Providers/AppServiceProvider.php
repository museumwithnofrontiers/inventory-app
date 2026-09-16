<?php

namespace App\Providers;

use App\Events\CollectionTranslationSaved;
use App\Events\ItemTranslationSaved;
use App\Events\SpellingSaved;
use App\Events\TimelineEventTranslationSaved;
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
use App\Services\Settings;
use App\Support\Documentation\RuleTransformers\IncludeRuleTransformer;
use App\View\Composers\SettingsComposer;
use Dedoc\Scramble\Scramble;
use Dedoc\Scramble\Support\Generator\OpenApi;
use Dedoc\Scramble\Support\Generator\SecurityScheme;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;
use Spatie\Permission\Models\Role;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(Settings::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Public picture endpoint throttle — configurable via PUB_PICTURES_THROTTLE env var
        RateLimiter::for('pub-pictures', function (Request $request) {
            return Limit::perMinute(Config::integer('app.pub_pictures_throttle', 60))
                ->by($request->ip());
        });

        // Register glossary link maintenance event listeners
        Event::listen(ItemTranslationSaved::class, DispatchSyncItemTranslationSpellings::class);
        Event::listen(CollectionTranslationSaved::class, DispatchSyncCollectionTranslationSpellings::class);
        Event::listen(TimelineEventTranslationSaved::class, DispatchSyncTimelineEventTranslationSpellings::class);
        Event::listen(SpellingSaved::class, DispatchSyncSpellingToItemTranslations::class);
        Event::listen(SpellingSaved::class, DispatchSyncSpellingToCollectionTranslations::class);
        Event::listen(SpellingSaved::class, DispatchSyncSpellingToTimelineEventTranslations::class);

        // Inject settings (e.g. self_registration_enabled) into shared layouts
        View::composer(
            ['components.app-nav', 'auth.login', 'navigation-menu', 'welcome'],
            SettingsComposer::class
        );

        // Share entity color config helper across views
        View::share('entityColor', function (string $entity): array {
            $map = Config::array('app_entities.colors', []);
            $fragments = Config::array('app_entities.fragments', []);
            $colorRaw = $map[$entity] ?? null;
            $color = is_string($colorRaw) ? $colorRaw : 'gray';
            $fragmentDefault = [
                'button' => 'bg-gray-600 hover:bg-gray-700 text-white',
                'focus' => 'focus:border-gray-500 focus:ring-gray-500',
                'badge' => 'bg-gray-100 text-gray-700',
                'accentText' => 'text-gray-700',
                'accentLink' => 'text-gray-600 hover:text-gray-800',
                'pill' => 'bg-gray-100 text-gray-600',
                'base' => 'gray-500',
                'bg' => 'bg-gray-50',
                'text' => 'text-gray-600',
            ];
            $fragmentRaw = $fragments[$color] ?? null;
            $fragment = is_array($fragmentRaw) ? $fragmentRaw : $fragmentDefault;

            return array_merge(['name' => $color], $fragment);
        });

        // Share version information to all views. This will be resolved from
        // config('app.version') or the VERSION file included by the CI pipeline.
        View::share('app_version_info', function () {
            // Initialize with null values
            $info = [
                'app_version' => null,
                'build_timestamp' => null,
                'commit_sha' => null,
                'repository' => null,
                'repository_url' => null,
            ];

            // If VERSION file exists, load it
            $versionPath = base_path('VERSION');
            if (file_exists($versionPath)) {
                try {
                    $content = file_get_contents($versionPath);
                    if ($content === false) {
                        throw new \RuntimeException("Cannot read {$versionPath}");
                    }

                    // Remove UTF-8 BOM if present
                    if (substr($content, 0, 3) === "\xEF\xBB\xBF") {
                        $content = substr($content, 3);
                    }

                    $versionData = json_decode($content, true);

                    if (json_last_error() === JSON_ERROR_NONE && is_array($versionData)) {
                        $info = array_merge($info, $versionData);
                    }
                } catch (\Exception $e) {
                    // Continue with null values if file reading fails
                }
            }

            // Fallback to config for app_version if not available from VERSION file
            if (is_null($info['app_version'])) {
                // Try to read version from package.json
                $packagePath = base_path('package.json');
                if (file_exists($packagePath)) {
                    try {
                        $packageContent = file_get_contents($packagePath);
                        if ($packageContent === false) {
                            throw new \RuntimeException("Cannot read {$packagePath}");
                        }
                        $packageData = json_decode($packageContent, true);
                        if (json_last_error() === JSON_ERROR_NONE && is_array($packageData) && isset($packageData['version'])) {
                            $info['app_version'] = $packageData['version'];
                        }
                    } catch (\Exception $e) {
                        // Continue to next fallback if package.json reading fails
                    }
                }

                // If still null, use config fallback
                if (is_null($info['app_version'])) {
                    $info['app_version'] = config('app.version', 'dev');
                }
            }

            return $info;
        });

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
