<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title>{{ config('app.name', 'Laravel') }}</title>

        <!-- Favicon -->
        <link rel="icon" type="image/svg+xml" href="{{ asset('favicon.svg') }}">
        <link rel="icon" type="image/x-icon" href="{{ asset('favicon.ico') }}">
        <link rel="apple-touch-icon" href="{{ asset('favicon.svg') }}">
        <link rel="manifest" href="{{ asset('site.webmanifest') }}">

        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

        <!-- Scripts -->
        @if(!app()->environment('testing') && config('app.env') !== 'testing')
            @vite(['resources/css/app.css', 'resources/js/app.js'])
        @else
            <!-- Testing environment: Skip Vite assets -->
            <style>
                body { 
                    font-family: 'Inter', system-ui, sans-serif; 
                    background-color: #f9fafb;
                    color: #111827;
                }
                .font-sans { font-family: 'Inter', system-ui, sans-serif; }
                .min-h-screen { min-height: 100vh; }
                .bg-gray-100 { background-color: #f3f4f6; }
                .bg-gray-50 { background-color: #f9fafb; }
                .antialiased { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
            </style>
        @endif

        <!-- Styles -->
        @livewireStyles
    </head>
    <body class="font-sans antialiased">
        <x-banner />

        <div class="min-h-screen bg-gray-50">
            {{-- Replaced Jetstream Livewire navigation with grouped Blade nav --}}
            <x-app-nav />

            {{-- Centralized Flash Notifications --}}
            @if(session('success') || session('error') || session('warning') || session('info'))
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
                    @if(session('success'))
                        <x-ui.notification type="success" :message="session('success')" :autoClose="5000" />
                    @endif
                    
                    @if(session('error'))
                        <x-ui.notification type="error" :message="session('error')" />
                    @endif
                    
                    @if(session('warning'))
                        <x-ui.notification type="warning" :message="session('warning')" :autoClose="5000" />
                    @endif
                    
                    @if(session('info'))
                        <x-ui.notification type="info" :message="session('info')" :autoClose="5000" />
                    @endif
                </div>
            @endif

            <!-- Page Heading -->
            @if (isset($header))
                <header class="bg-white shadow">
                    <div class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                        {{ $header }}
                    </div>
                </header>
            @endif

            <!-- Page Content -->
            <main>
                @yield('content')
            </main>
        </div>

        @stack('modals')

        <!-- Confirmation Modal (Livewire) -->
        @livewire('confirmation-modal')

    @livewireScripts

    <!-- App Footer Component -->
    <x-app-footer />
    </body>
</html>

