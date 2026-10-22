<x-filament-panels::page>
    <x-filament::section>
        <x-slot name="heading">
            {{ __(':app wants to use your account', ['app' => $clientName]) }}
        </x-slot>

        <x-slot name="description">
            {{ __('Signed in as :email. It will act with your permissions, limited to:', ['email' => auth()->user()?->email]) }}
        </x-slot>

        <ul class="list-disc space-y-1 ps-6 text-sm">
            @forelse ($scopes as $scope)
                <li>{{ $scope['description'] }} <span class="font-mono text-gray-500">({{ $scope['id'] }})</span></li>
            @empty
                <li>{{ __('Nothing beyond knowing who you are') }}</li>
            @endforelse
        </ul>

        @if ($redirectUri !== '')
            <p class="mt-4 text-sm text-gray-500">
                {{ __('Your answer goes back to') }} <span class="font-mono break-all">{{ $redirectUri }}</span>
            </p>
        @endif

        <div class="mt-6 flex flex-wrap gap-3">
            <form method="POST" action="{{ route('passport.authorizations.approve') }}">
                @csrf
                <input type="hidden" name="auth_token" value="{{ $authToken }}">
                <x-filament::button type="submit">{{ __('Approve') }}</x-filament::button>
            </form>

            <form method="POST" action="{{ route('passport.authorizations.deny') }}">
                @csrf
                @method('DELETE')
                <input type="hidden" name="auth_token" value="{{ $authToken }}">
                <x-filament::button type="submit" color="gray">{{ __('Deny') }}</x-filament::button>
            </form>
        </div>
    </x-filament::section>
</x-filament-panels::page>
