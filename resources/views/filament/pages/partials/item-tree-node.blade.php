@php
    $isExpanded = isset($this->expanded[$node->id]);
    $hasChildren = $node->children_count > 0;
    $indent = $depth * 1.5;
    $typeLabel = $node->type instanceof \App\Enums\ItemType ? $node->type->label() : (string) $node->type;
@endphp

<div class="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-white/5 transition"
     style="padding-left: {{ 1 + $indent }}rem">

    {{-- Expand / collapse control --}}
    @if ($hasChildren)
        <button
            wire:click="toggle('{{ $node->id }}')"
            class="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition"
            title="{{ $isExpanded ? 'Collapse' : 'Expand' }}"
        >
            @if ($isExpanded)
                <x-filament::icon icon="heroicon-s-chevron-down" class="h-4 w-4" />
            @else
                <x-filament::icon icon="heroicon-s-chevron-right" class="h-4 w-4" />
            @endif
        </button>
    @else
        <span class="flex-shrink-0 w-4 h-4"></span>
    @endif

    {{-- Node icon --}}
    <x-filament::icon
        icon="heroicon-o-cube"
        class="flex-shrink-0 h-4 w-4 text-gray-400 dark:text-gray-500"
    />

    {{-- Name --}}
    <div class="flex-1 min-w-0">
        <a
            href="{{ \App\Filament\Resources\ItemResource::getUrl('view', ['record' => $node->id]) }}"
            class="text-sm font-medium text-gray-900 dark:text-white hover:underline truncate block"
        >
            {{ \App\Support\Markdown\MarkdownText::inline($node->display_label ?? $node->internal_name) }}
        </a>
        @if (isset($node->display_label) && $node->display_label !== $node->internal_name)
            <span class="text-xs text-gray-400 dark:text-gray-500 truncate block">{{ \App\Support\Markdown\MarkdownText::inline($node->internal_name) }}</span>
        @endif
    </div>

    {{-- Type badge --}}
    <span class="flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">
        {{ $typeLabel }}
    </span>

    {{-- Child count --}}
    @if ($hasChildren)
        <span class="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">
            {{ $node->children_count }} {{ Str::plural('child', $node->children_count) }}
        </span>
    @endif
</div>

{{-- Lazy-loaded children rendered only when expanded --}}
@if ($isExpanded && $hasChildren)
    @foreach ($this->getChildren($node->id) as $child)
        @include('filament.pages.partials.item-tree-node', [
            'node' => $child,
            'depth' => $depth + 1,
        ])
    @endforeach
@endif
