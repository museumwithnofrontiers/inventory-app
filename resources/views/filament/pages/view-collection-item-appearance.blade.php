<x-filament-panels::page>
    <x-filament::section>
        <x-slot name="heading">Appearance identity</x-slot>

        <dl class="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <div>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Collection</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                    @if ($this->collectionUrl())
                        <a href="{{ $this->collectionUrl() }}" class="text-primary-600 hover:underline dark:text-primary-400">
                            {{ \App\Support\Markdown\MarkdownText::inline($collection->display_label ?? $collection->internal_name) }}
                        </a>
                    @else
                        {{ \App\Support\Markdown\MarkdownText::inline($collection->display_label ?? $collection->internal_name) }}
                    @endif
                </dd>
            </div>
            <div>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Item</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                    @if ($this->itemUrl())
                        <a href="{{ $this->itemUrl() }}" class="text-primary-600 hover:underline dark:text-primary-400">
                            {{ \App\Support\Markdown\MarkdownText::inline($item->display_label ?? $item->internal_name) }}
                        </a>
                    @else
                        {{ \App\Support\Markdown\MarkdownText::inline($item->display_label ?? $item->internal_name) }}
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

    @php($exploreMonuments = $this->exploreMonumentSummaries())
    @if ($exploreMonuments !== [])
        <x-filament::section>
            <x-slot name="heading">Explore monuments</x-slot>
            <ol class="list-decimal space-y-1 ps-5 text-sm text-gray-900 dark:text-gray-100">
                @foreach ($exploreMonuments as $summary)
                    <li class="font-mono">{{ $summary }}</li>
                @endforeach
            </ol>
        </x-filament::section>
    @endif

    {{ $this->table }}
</x-filament-panels::page>
