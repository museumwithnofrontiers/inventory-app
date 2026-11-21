@php
    $isExpanded = isset($this->expanded[$node->id]);
    $hasEvents = $node->events_count > 0;
    $indent = $depth * 1.5;
@endphp

<div class="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-white/5 transition"
     style="padding-left: {{ 1 + $indent }}rem">

    {{-- Expand / collapse control --}}
    @if ($hasEvents)
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
        icon="heroicon-o-clock"
        class="flex-shrink-0 h-4 w-4 text-gray-400 dark:text-gray-500"
    />

    {{-- Name --}}
    <div class="flex-1 min-w-0">
        <a
            href="{{ \App\Filament\Resources\TimelineResource::getUrl('view', ['record' => $node->id]) }}"
            class="text-sm font-medium text-gray-900 dark:text-white hover:underline truncate block"
        >
            {{ \App\Support\Markdown\MarkdownText::inline($node->internal_name) }}
        </a>
    </div>

    {{-- Event count --}}
    @if ($hasEvents)
        <span class="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">
            {{ $node->events_count }} {{ Str::plural('event', $node->events_count) }}
        </span>
    @endif
</div>

{{-- Lazy-loaded events rendered only when expanded --}}
@if ($isExpanded && $hasEvents)
    @foreach ($this->getEvents($node->id) as $event)
        @php
            $eventIndent = ($depth + 1) * 1.5;
        @endphp
        <div class="px-4 py-2 flex items-center gap-3 bg-gray-50 dark:bg-white/5"
             style="padding-left: {{ 1 + $eventIndent }}rem">
            <span class="flex-shrink-0 w-4 h-4"></span>
            <x-filament::icon
                icon="heroicon-o-calendar-days"
                class="flex-shrink-0 h-4 w-4 text-indigo-400 dark:text-indigo-500"
            />
            <div class="flex-1 min-w-0">
                <a
                    href="{{ \App\Filament\Resources\TimelineEventResource::getUrl('view', ['record' => $event->id]) }}"
                    class="text-sm text-gray-700 dark:text-gray-300 hover:underline truncate block"
                >
                    {{ \App\Support\Markdown\MarkdownText::inline($event->display_label ?? $event->internal_name) }}
                </a>
                @if (isset($event->display_label) && $event->display_label !== $event->internal_name)
                    <span class="text-xs text-gray-400 dark:text-gray-500 truncate block">{{ \App\Support\Markdown\MarkdownText::inline($event->internal_name) }}</span>
                @endif
            </div>
        </div>
    @endforeach
@endif
