{{-- Welcome Page --}}
<x-app-layout>
    {{-- Hero Section --}}
    <div class="py-8">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <x-welcome-hero>
                <x-slot name="title">
                    {{ config('app.name') }}
                </x-slot>
                
                <x-slot name="description">
                    Comprehensive digital cataloging system for museum collections. Track, organize, and manage your artifacts with detailed metadata and high-resolution imagery.
                </x-slot>
                
                <x-slot name="actions">
                    @auth
                        <x-welcome-cta-button href="{{ route('items.index') }}" variant="outline">
                            <x-heroicon-o-squares-2x2 class="size-5 mr-2" />
                            Inventory Management Client
                        </x-welcome-cta-button>
                    @else
                        <x-welcome-cta-button href="{{ route('login') }}" variant="outline">
                            <x-heroicon-o-arrow-right-on-rectangle class="size-5 mr-2" />
                            Login
                        </x-welcome-cta-button>
                        
                        @if (Route::has('register') && $selfRegistrationEnabled)
                            <x-welcome-cta-button href="{{ route('register') }}" variant="secondary">
                                <x-heroicon-o-user-plus class="size-5 mr-2" />
                                Register
                            </x-welcome-cta-button>
                        @endif
                    @endauth
                </x-slot>
                
                <x-slot name="illustration">
                    <x-heroicon-o-building-library class="size-32 text-blue-200 opacity-50" />
                </x-slot>
            </x-welcome-hero>
        </div>
    </div>

    {{-- Primary Access Tiles (Guest emphasis) --}}
    <div class="py-8">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                @guest
                    {{-- Login Tile (Prominent) --}}
                    <x-ui.card 
                        href="{{ route('login') }}"
                        title="Sign In"
                        description="Access the authenticated inventory management portal."
                        :icon="'<x-heroicon-o-arrow-right-on-rectangle class=\'w-6 h-6\' />'"
                        iconColor="indigo"
                        :highlighted="true"
                    >Login</x-ui.card>
                    
                    @if(Route::has('register') && $selfRegistrationEnabled)
                        {{-- Register Tile --}}
                        <x-ui.card 
                            href="{{ route('register') }}"
                            title="Create Account"
                            description="Register to start cataloging items and managing partners."
                            :icon="'<x-heroicon-o-user-plus class=\'w-6 h-6\' />'"
                            iconColor="indigo"
                        >Register</x-ui.card>
                    @endif
                @else
                    {{-- Direct Inventory Access (Authenticated) --}}
                    <x-ui.card 
                        href="{{ route('items.index') }}"
                        title="Items"
                        description="Browse and manage inventory item records."
                        :icon="'<x-heroicon-o-archive-box class=\'w-6 h-6\' />'"
                        iconColor="teal"
                        :highlighted="true"
                    >Open</x-ui.card>
                @endguest

                {{-- API Documentation --}}
                <x-ui.card 
                    href="{{ url('/docs/api') }}"
                    title="API Docs"
                    description="Reference for the REST endpoints and data contracts."
                    :icon="'<x-heroicon-o-book-open class=\'w-6 h-6\' />'"
                    iconColor="indigo"
                >Browse</x-ui.card>

                {{-- Source Code --}}
                <x-ui.card 
                    href="https://github.com/metanull/inventory-app"
                    title="Source Code"
                    description="Explore the repository and contribute improvements."
                    :icon="'<x-heroicon-o-code-bracket class=\'w-6 h-6\' />'"
                    iconColor="indigo"
                >Open</x-ui.card>

                {{-- Project Docs --}}
                <x-ui.card 
                    href="https://metanull.github.io/inventory-app"
                    title="Project Docs"
                    description="View comprehensive project documentation and guidelines."
                    :icon="'<x-heroicon-o-document-text class=\'w-6 h-6\' />'"
                    iconColor="indigo"
                >Read</x-ui.card>
            </div>
        </div>
    </div>

    {{-- Call to Action Section --}}
    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-gray-50 rounded-xl p-8 lg:p-12 text-center">
                <x-heroicon-o-sparkles class="size-16 mx-auto text-blue-800 mb-6" />
                <h2 class="text-3xl font-bold text-gray-900 mb-4">
                    Ready to Manage your Items?
                </h2>
                <p class="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
                    Clicking the link below will allow you to manage your inventory and access all cataloging features.
                </p>
                <div class="flex flex-wrap justify-center gap-4">
                    @guest
                        @if($selfRegistrationEnabled)
                            <x-welcome-cta-button href="{{ route('register') }}" variant="primary">
                                <x-heroicon-o-user-plus class="size-5 mr-2" />
                                Get Started Today
                            </x-welcome-cta-button>
                        @endif
                        <x-welcome-cta-button href="{{ route('login') }}" variant="secondary">
                            <x-heroicon-o-arrow-right-on-rectangle class="size-5 mr-2" />
                            Sign In
                        </x-welcome-cta-button>
                    @else
                        <x-welcome-cta-button href="{{ route('items.index') }}" variant="primary">
                            <x-heroicon-o-squares-2x2 class="size-5 mr-2" />
                            Continue to the Inventory Management Client
                        </x-welcome-cta-button>
                    @endguest
                </div>
            </div>
        </div>
    </div>

    {{-- Hidden logout form for authenticated users --}}
    @auth
        <form id="logout-form" method="POST" action="{{ route('logout') }}" class="hidden">
            @csrf
        </form>
    @endauth
</x-app-layout>
