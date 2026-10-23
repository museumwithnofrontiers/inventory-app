<?php

namespace App\Support\LegacyLinks;

use App\Enums\LegacyLinkConfidence;
use App\Enums\LegacyLinkType;

final readonly class LegacyLink
{
    public function __construct(
        public string $label,
        public ?string $url,
        public LegacyLinkType $type,
        public LegacyLinkConfidence $confidence,
        public string $source,
        public ?string $note = null,
    ) {}

    /**
     * @return array{label: string, url: ?string, type: string, confidence: string, source: string, note: ?string}
     */
    public function toArray(): array
    {
        return [
            'label' => $this->label,
            'url' => $this->url,
            'type' => $this->type->value,
            'confidence' => $this->confidence->value,
            'source' => $this->source,
            'note' => $this->note,
        ];
    }

    public static function public(
        string $label,
        string $url,
        LegacyLinkConfidence $confidence,
        string $source,
        ?string $note = null,
    ): self {
        return new self($label, $url, LegacyLinkType::PUBLIC, $confidence, $source, $note);
    }

    public static function backoffice(
        string $label,
        string $url,
        LegacyLinkConfidence $confidence,
        string $source,
        ?string $note = null,
    ): self {
        return new self($label, $url, LegacyLinkType::BACKOFFICE, $confidence, $source, $note);
    }

    public static function diagnostic(
        string $label,
        LegacyLinkConfidence $confidence,
        string $source,
        string $note,
    ): self {
        return new self($label, null, LegacyLinkType::DIAGNOSTIC, $confidence, $source, $note);
    }
}
