<x-filament-panels::page>
    <x-filament::section>
        <x-slot name="heading">Appearance identity</x-slot>

        <dl class="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <div>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Collection</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                    @if ($this->collectionUrl())
                        <a href="{{ $this->collectionUrl() }}" class="text-primary-600 hover:underline dark:text-primary-400">
                            {{ $collection->display_label ?? $collection->internal_name }}
                        </a>
                    @else
                        {{ $collection->display_label ?? $collection->internal_name }}
                    @endif
                </dd>
            </div>
            <div>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Item</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                    @if ($this->itemUrl())
                        <a href="{{ $this->itemUrl() }}" class="text-primary-600 hover:underline dark:text-primary-400">
                            {{ $item->display_label ?? $item->internal_name }}
                        </a>
                    @else
                        {{ $item->display_label ?? $item->internal_name }}
                    @endif
                </dd>
            </div>
            <div>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Display order</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                    {{ $displayOrder ?? '—' }}
                </dd>
            </div>
        </dl>
    </x-filament::section>

    {{ $this->table }}
</x-filament-panels::page>
