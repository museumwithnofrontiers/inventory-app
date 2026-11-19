<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Api\Concerns\HasIncludes;
use App\Rules\IncludeRule;
use Illuminate\Foundation\Http\FormRequest;

class ShowCollectionItemExploreMonumentRequest extends FormRequest
{
    use HasIncludes;

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'include' => ['sometimes', 'string', new IncludeRule('collection_item_explore_monument')],
        ];
    }

    protected function getIncludeAllowlistKey(): string
    {
        return 'collection_item_explore_monument';
    }
}
