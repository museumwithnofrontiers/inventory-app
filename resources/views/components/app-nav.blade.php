@props([
    'groupClass' => 'space-y-1',
])
<nav x-data="{ mobile:false, openMenu:null }" x-cloak class="bg-white border-b border-gray-100 shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center gap-8">
            <a href="{{ route('web.welcome') }}" class="flex items-center gap-2 text-indigo-600 font-semibold">
                <x-application-mark class="block h-8 w-auto" />
                <span class="hidden sm:inline">{{ config('app.name') }}</span>
            </a>
            <div class="hidden md:flex gap-6 text-sm">
                @can(\App\Enums\Permission::VIEW_DATA->value)
                <!-- Inventory Dropdown -->
                <div class="relative" @mouseenter="openMenu='inventory'" @mouseleave="openMenu=null">
                    <button @click="openMenu = openMenu==='inventory'? null : 'inventory'" type="button" class="inline-flex items-center gap-1 px-2 py-1 rounded-md font-medium {{ request()->routeIs('items.*') || request()->routeIs('partners.*') || request()->routeIs('projects.*') || request()->routeIs('collections.*') ? 'text-indigo-700 bg-indigo-50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50' }}">
                        <x-heroicon-o-squares-2x2 class="w-4 h-4" />
                        Inventory
                        <span class="w-4 h-4 transition" x-bind:class="openMenu==='inventory' ? 'rotate-180' : ''">
                            <x-heroicon-o-chevron-down class="w-4 h-4" />
                        </span>
                    </button>
                    <div x-show="openMenu==='inventory'" x-transition x-cloak @click.outside="openMenu=null" class="absolute z-30 mt-2 w-56 rounded-md border border-gray-200 bg-white shadow-lg py-2">
                        <x-nav.menu-item 
                            :route="route('items.index')"
                            routePattern="items.*"
                            entity="items"
                            icon="archive-box"
                            label="Items"
                        />
                        <x-nav.menu-item 
                            :route="route('partners.index')"
                            routePattern="partners.*"
                            entity="partners"
                            icon="user-group"
                            label="Partners"
                        />
                        <x-nav.menu-item 
                            :route="route('projects.index')"
                            routePattern="projects.*"
                            entity="projects"
                            icon="rocket-launch"
                            label="Projects"
                        />
                        <x-nav.menu-item 
                            :route="route('collections.index')"
                            routePattern="collections.*"
                            entity="collections"
                            icon="rectangle-stack"
                            label="Collections"
                        />
                    </div>
                </div>

                <!-- Translations Dropdown -->
                <div class="relative" @mouseenter="openMenu='translations'" @mouseleave="openMenu=null">
                    <button @click="openMenu = openMenu==='translations'? null : 'translations'" type="button" class="inline-flex items-center gap-1 px-2 py-1 rounded-md font-medium {{ request()->routeIs('item-translations.*') || request()->routeIs('partner-translations.*') || request()->routeIs('project-translations.*') || request()->routeIs('collection-translations.*') ? 'text-indigo-700 bg-indigo-50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50' }}">
                        <x-heroicon-o-language class="w-4 h-4" />
                        Translations
                        <span class="w-4 h-4 transition" x-bind:class="openMenu==='translations' ? 'rotate-180' : ''">
                            <x-heroicon-o-chevron-down class="w-4 h-4" />
                        </span>
                    </button>
                    <div x-show="openMenu==='translations'" x-transition x-cloak @click.outside="openMenu=null" class="absolute z-30 mt-2 w-56 rounded-md border border-gray-200 bg-white shadow-lg py-2">
                        <x-nav.menu-item 
                            :route="route('item-translations.index')"
                            routePattern="item-translations.*"
                            entity="item_translations"
                            icon="language"
                            label="Items"
                        />
                        <x-nav.menu-item 
                            :route="route('partner-translations.index')"
                            routePattern="partner-translations.*"
                            entity="partner_translations"
                            icon="language"
                            label="Partners"
                        />
                        <x-nav.menu-item 
                            :route="route('collection-translations.index')"
                            routePattern="collection-translations.*"
                            entity="collection_translations"
                            icon="language"
                            label="Collections"
                        />
                    </div>
                </div>

                <!-- Reference Dropdown -->
                <div class="relative" @mouseenter="openMenu='reference'" @mouseleave="openMenu=null">
                    <button @click="openMenu = openMenu==='reference'? null : 'reference'" type="button" class="inline-flex items-center gap-1 px-2 py-1 rounded-md font-medium {{ request()->routeIs('countries.*') || request()->routeIs('languages.*') || request()->routeIs('contexts.*') || request()->routeIs('glossaries.*') || request()->routeIs('glossaries.translations.*') || request()->routeIs('glossaries.spellings.*') ? 'text-indigo-700 bg-indigo-50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50' }}">
                        <x-heroicon-o-book-open class="w-4 h-4" /> Reference
                        <span class="w-4 h-4 transition" x-bind:class="openMenu==='reference' ? 'rotate-180' : ''">
                            <x-heroicon-o-chevron-down class="w-4 h-4" />
                        </span>
                    </button>
                    <div x-show="openMenu==='reference'" x-transition x-cloak @click.outside="openMenu=null" class="absolute z-30 mt-2 w-56 rounded-md border border-gray-200 bg-white shadow-lg py-2">
                        <x-nav.menu-item 
                            :route="route('countries.index')"
                            routePattern="countries.*"
                            entity="countries"
                            icon="globe-europe-africa"
                            label="Countries"
                        />
                        <x-nav.menu-item 
                            :route="route('languages.index')"
                            routePattern="languages.*"
                            entity="languages"
                            icon="language"
                            label="Languages"
                        />
                        <x-nav.menu-item 
                            :route="route('contexts.index')"
                            routePattern="contexts.*"
                            entity="contexts"
                            icon="adjustments-horizontal"
                            label="Contexts"
                        />
                        <x-nav.menu-item 
                            :route="route('glossaries.index')"
                            routePattern="glossaries.*"
                            entity="glossaries"
                            icon="book-open"
                            label="Glossary"
                        />
                        <x-nav.menu-item 
                            :route="route('tags.index')"
                            routePattern="tags.*"
                            entity="tags"
                            icon="tag"
                            label="Tags"
                        />
                        <x-nav.menu-item 
                            :route="route('authors.index')"
                            routePattern="authors.*"
                            entity="authors"
                            icon="user-circle"
                            label="Authors"
                        />
                    </div>
                </div>

                <!-- Images Dropdown -->
                <div class="relative" @mouseenter="openMenu='images'" @mouseleave="openMenu=null">
                    <button @click="openMenu = openMenu==='images'? null : 'images'" type="button" class="inline-flex items-center gap-1 px-2 py-1 rounded-md font-medium {{ request()->routeIs('available-images.*') || request()->routeIs('images.*') ? 'text-indigo-700 bg-indigo-50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50' }}">
                        <x-heroicon-o-photo class="w-4 h-4" /> Images
                        <span class="w-4 h-4 transition" x-bind:class="openMenu==='images' ? 'rotate-180' : ''">
                            <x-heroicon-o-chevron-down class="w-4 h-4" />
                        </span>
                    </button>
                    <div x-show="openMenu==='images'" x-transition x-cloak @click.outside="openMenu=null" class="absolute z-30 mt-2 w-56 rounded-md border border-gray-200 bg-white shadow-lg py-2">
                        <x-nav.menu-item 
                            :route="route('available-images.index')"
                            routePattern="available-images.*"
                            entity="available-images"
                            icon="photo"
                            label="Available Images"
                        />
                        @can(\App\Enums\Permission::CREATE_DATA->value)
                        <x-nav.menu-item 
                            :route="route('images.upload')"
                            routePattern="images.upload"
                            entity="available-images"
                            icon="cloud-arrow-up"
                            label="Upload Images"
                        />
                        @endcan
                    </div>
                </div>
                @endcan

                <!-- Resources Dropdown -->
                <div class="relative" @mouseenter="openMenu='resources'" @mouseleave="openMenu=null">
                    <button @click="openMenu = openMenu==='resources'? null : 'resources'" type="button" class="inline-flex items-center gap-1 px-2 py-1 rounded-md font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50">
                        <x-heroicon-o-circle-stack class="w-4 h-4" /> Resources
                        <span class="w-4 h-4 transition" x-bind:class="openMenu==='resources' ? 'rotate-180' : ''">
                            <x-heroicon-o-chevron-down class="w-4 h-4" />
                        </span>
                    </button>
                    <div x-show="openMenu==='resources'" x-transition x-cloak @click.outside="openMenu=null" class="absolute z-30 mt-2 w-60 rounded-md border border-gray-200 bg-white shadow-lg py-2">
                        <a href="{{ url('/docs/api') }}" class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <x-heroicon-o-book-open class="w-4 h-4" /> API Docs
                        </a>
                        <a href="https://github.com/museumwithnofrontiers/inventory-app" target="_blank" class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <x-heroicon-o-code-bracket class="w-4 h-4" /> Source Code
                        </a>
                        <a href="https://museumwithnofrontiers.github.io/inventory-app" target="_blank" class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <x-heroicon-o-document-text class="w-4 h-4" /> Project Docs
                        </a>
                    </div>
                </div>

                @auth
                    @if(auth()->user()->can(\App\Enums\Permission::MANAGE_USERS->value) || auth()->user()->can(\App\Enums\Permission::MANAGE_ROLES->value) || auth()->user()->can(\App\Enums\Permission::MANAGE_SETTINGS->value))
                        <!-- Administration Dropdown -->
                        <div class="relative" @mouseenter="openMenu='admin'" @mouseleave="openMenu=null">
                            <button @click="openMenu = openMenu==='admin'? null : 'admin'" type="button" class="inline-flex items-center gap-1 px-2 py-1 rounded-md font-medium {{ request()->routeIs('admin.*') ? 'text-indigo-700 bg-indigo-50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50' }}">
                                <x-heroicon-o-cog-6-tooth class="w-4 h-4" /> Administration
                                <span class="w-4 h-4 transition" x-bind:class="openMenu==='admin' ? 'rotate-180' : ''">
                                    <x-heroicon-o-chevron-down class="w-4 h-4" />
                                </span>
                            </button>
                            <div x-show="openMenu==='admin'" x-transition x-cloak @click.outside="openMenu=null" class="absolute z-30 mt-2 w-60 rounded-md border border-gray-200 bg-white shadow-lg py-2">
                                <div class="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                                    System Management
                                </div>
                                @can(\App\Enums\Permission::MANAGE_USERS->value)
                                    <x-nav.menu-item 
                                        :route="route('admin.users.index')"
                                        routePattern="admin.users.*"
                                        entity="users"
                                        icon="users"
                                        label="User Management"
                                    />
                                @endcan
                                @can(\App\Enums\Permission::MANAGE_ROLES->value)
                                    <x-nav.menu-item 
                                        :route="route('admin.roles.index')"
                                        routePattern="admin.roles.*"
                                        entity="roles"
                                        icon="shield-check"
                                        label="Role Management"
                                    />
                                @endcan
                                @can(\App\Enums\Permission::MANAGE_SETTINGS->value)
                                    <x-nav.menu-item 
                                        :route="route('settings.index')"
                                        routePattern="settings.*"
                                        entity="users"
                                        icon="cog-6-tooth"
                                        label="Settings"
                                    />
                                @endcan
                            </div>
                        </div>
                    @endif
                @endauth
            </div>
        </div>
        <div class="flex items-center gap-4">
            @auth
                <div class="hidden md:flex items-center gap-3">
                    <a href="{{ route('web.profile.show') }}" class="inline-flex items-center gap-1 px-2 py-1 rounded-md font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 text-sm">
                        <x-heroicon-o-user class="w-4 h-4" />
                        Profile
                    </a>
                    <form method="POST" action="{{ route('logout') }}">
                        @csrf
                        <button type="submit" class="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50">Logout</button>
                    </form>
                </div>
            @else
                <div class="hidden md:flex items-center gap-2 text-sm">
                    <a href="{{ route('login') }}" class="px-2 py-1 rounded text-gray-600 hover:text-gray-800 hover:bg-gray-50">Login</a>
                    @if(Route::has('register') && $selfRegistrationEnabled)
                        <a href="{{ route('register') }}" class="px-2 py-1 rounded text-gray-600 hover:text-gray-800 hover:bg-gray-50">Register</a>
                    @endif
                </div>
            @endauth
            <button @click="mobile = !mobile" class="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:bg-gray-100 focus:outline-none">
                <x-heroicon-o-bars-3 class="w-6 h-6" x-show="!mobile" />
                <x-heroicon-o-x-mark class="w-6 h-6" x-show="mobile" />
            </button>
        </div>
    </div>
    <div x-show="mobile" x-transition x-cloak class="md:hidden border-t border-gray-200 bg-white">
        <div class="px-4 py-4 space-y-6 text-sm">
            @can(\App\Enums\Permission::VIEW_DATA->value)
            <div class="space-y-2">
                <p class="text-[11px] font-semibold text-gray-400 uppercase">Inventory</p>
                <x-nav.menu-item 
                    :route="route('items.index')"
                    routePattern="items.*"
                    entity="items"
                    label="Items"
                    mobile
                />
                <x-nav.menu-item 
                    :route="route('partners.index')"
                    routePattern="partners.*"
                    entity="partners"
                    label="Partners"
                    mobile
                />
                <x-nav.menu-item 
                    :route="route('projects.index')"
                    routePattern="projects.*"
                    entity="projects"
                    label="Projects"
                    mobile
                />
                <x-nav.menu-item 
                    :route="route('collections.index')"
                    routePattern="collections.*"
                    entity="collections"
                    label="Collections"
                    mobile
                />
            </div>
            <div class="space-y-2">
                <p class="text-[11px] font-semibold text-gray-400 uppercase">Translations</p>
                <x-nav.menu-item 
                    :route="route('item-translations.index')"
                    routePattern="item-translations.*"
                    entity="item_translations"
                    label="Items"
                    mobile
                />
                <x-nav.menu-item 
                    :route="route('partner-translations.index')"
                    routePattern="partner-translations.*"
                    entity="partner_translations"
                    label="Partners"
                    mobile
                />
                <x-nav.menu-item 
                    :route="route('collection-translations.index')"
                    routePattern="collection-translations.*"
                    entity="collection_translations"
                    label="Collections"
                    mobile
                />
            </div>
            <div class="space-y-2">
                <p class="text-[11px] font-semibold text-gray-400 uppercase">Reference</p>
                <x-nav.menu-item 
                    :route="route('countries.index')"
                    routePattern="countries.*"
                    entity="countries"
                    label="Countries"
                    mobile
                />
                <x-nav.menu-item 
                    :route="route('languages.index')"
                    routePattern="languages.*"
                    entity="languages"
                    label="Languages"
                    mobile
                />
                <x-nav.menu-item 
                    :route="route('contexts.index')"
                    routePattern="contexts.*"
                    entity="contexts"
                    label="Contexts"
                    mobile
                />
            </div>
            <div class="space-y-2">
                <p class="text-[11px] font-semibold text-gray-400 uppercase">Images</p>
                <x-nav.menu-item 
                    :route="route('available-images.index')"
                    routePattern="available-images.*"
                    entity="available-images"
                    label="Available Images"
                    mobile
                />
                @can(\App\Enums\Permission::CREATE_DATA->value)
                <x-nav.menu-item 
                    :route="route('images.upload')"
                    routePattern="images.upload"
                    entity="available-images"
                    label="Upload Images"
                    mobile
                />
                @endcan
            </div>
            @endcan
            <div class="space-y-2">
                <p class="text-[11px] font-semibold text-gray-400 uppercase">Resources</p>
                <a href="{{ url('/docs/api') }}" class="block px-2 py-1 rounded text-gray-600 hover:bg-gray-50 hover:text-gray-800">API Docs</a>
                <a href="https://github.com/museumwithnofrontiers/inventory-app" target="_blank" class="block px-2 py-1 rounded text-gray-600 hover:bg-gray-50 hover:text-gray-800">Source Code</a>
                <a href="https://museumwithnofrontiers.github.io/inventory-app" target="_blank" class="block px-2 py-1 rounded text-gray-600 hover:bg-gray-50 hover:text-gray-800">Project Docs</a>
            </div>
            @auth
                @if(auth()->user()->can(\App\Enums\Permission::MANAGE_USERS->value) || auth()->user()->can(\App\Enums\Permission::MANAGE_ROLES->value))
                    <div class="space-y-2">
                        <p class="text-[11px] font-semibold text-gray-400 uppercase">Administration</p>
                        @can(\App\Enums\Permission::MANAGE_USERS->value)
                        <x-nav.menu-item 
                            :route="route('admin.users.index')"
                            routePattern="admin.users.*"
                            entity="users"
                            label="User Management"
                            mobile
                        />
                        @endcan
                        @can(\App\Enums\Permission::MANAGE_ROLES->value)
                        <x-nav.menu-item 
                            :route="route('admin.roles.index')"
                            routePattern="admin.roles.*"
                            entity="roles"
                            label="Role Management"
                            mobile
                        />
                        @endcan
                    </div>
                @endif
            @endauth
            <div class="pt-2 border-t border-gray-100">
                @auth
                    <div class="flex items-center justify-between">
                        <a href="{{ route('web.profile.show') }}" class="inline-flex items-center gap-2 px-2 py-1 rounded text-gray-600 hover:bg-gray-50 hover:text-gray-800">
                            <x-heroicon-o-user class="w-4 h-4" />
                            Profile
                        </a>
                        <form method="POST" action="{{ route('logout') }}" class="inline">
                            @csrf
                            <button type="submit" class="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50">Logout</button>
                        </form>
                    </div>
                @else
                    <div class="flex gap-2">
                        <a href="{{ route('login') }}" class="flex-1 text-center px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50">Login</a>
                        @if(Route::has('register') && $selfRegistrationEnabled)
                            <a href="{{ route('register') }}" class="flex-1 text-center px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50">Register</a>
                        @endif
                    </div>
                @endauth
            </div>
        </div>
    </div>
</nav>
