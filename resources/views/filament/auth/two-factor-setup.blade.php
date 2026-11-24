<x-filament-panels::page.simple>
    @if ($step === 'recovery-codes')
        <div class="mb-4 text-sm text-gray-600 dark:text-gray-400">
            {{ __('Store these recovery codes in a secure location. They will not be shown again.') }}
        </div>

        <div class="mb-6 space-y-1 rounded-lg bg-gray-50 p-4 font-mono text-sm dark:bg-gray-800">
            @foreach ($recoveryCodes as $code)
                <div>{{ $code }}</div>
            @endforeach
        </div>

        <x-filament::button
            wire:click="complete"
            color="primary"
            class="w-full"
        >
            {{ __('Continue to Dashboard') }}
        </x-filament::button>
    @else
        <div class="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
            <p class="font-semibold">{{ __('Two-factor authentication is required to access this panel.') }}</p>
            <p class="mt-1">{{ __('Scan the QR code below with your authenticator app (such as Google Authenticator, Authy, or 1Password) and enter the six-digit code to complete setup.') }}</p>
        </div>

        <div class="mb-4 flex justify-center">
            {!! $qrCodeSvg !!}
        </div>

        <div class="mb-4 text-center text-sm text-gray-600 dark:text-gray-400">
            {{ __('Setup Key:') }}
            <span class="font-mono">{{ $setupKey }}</span>
        </div>

        {{ $this->content }}
    @endif
</x-filament-panels::page.simple>
