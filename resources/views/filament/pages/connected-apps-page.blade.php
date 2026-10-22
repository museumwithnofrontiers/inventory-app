<x-filament-panels::page>
    @if ($mcpServerUrl = $this->mcpServerUrl())
        <x-filament::section>
            <x-slot name="heading">
                {{ __('Inventory MCP server') }}
            </x-slot>

            <x-slot name="description">
                {{ __('Give this address to an AI assistant, such as Claude, to let it browse the inventory with your permissions. It asks you to sign in and approve it, then appears below.') }}
            </x-slot>

            <div class="flex items-center gap-2" x-data="{ copied: false }">
                <code class="break-all rounded bg-gray-100 px-2 py-1 font-mono text-sm dark:bg-white/5">{{ $mcpServerUrl }}</code>
                <x-filament::icon-button
                    icon="heroicon-o-clipboard"
                    color="gray"
                    :label="__('Copy')"
                    x-on:click="window.navigator.clipboard.writeText({{ \Illuminate\Support\Js::from($mcpServerUrl) }}); copied = true; setTimeout(() => copied = false, 2000)"
                />
                <span x-show="copied" x-cloak class="text-sm text-gray-500">{{ __('Copied') }}</span>
            </div>
        </x-filament::section>
    @endif

    {{ $this->table }}
</x-filament-panels::page>
