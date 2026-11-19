<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Api\Concerns\ValidatesCollectionItemExploreMonumentFields;
use App\Models\CollectionItemExploreMonument;
use App\Rules\IncludeRule;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCollectionItemExploreMonumentRequest extends FormRequest
{
    use ValidatesCollectionItemExploreMonumentFields;

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $monument = $this->route('collectionItemExploreMonument');
        $current = $monument instanceof CollectionItemExploreMonument ? $monument : null;

        return [
            'id' => ['prohibited'],
            'collection_item_id' => ['prohibited'],
            'position' => [
                'sometimes', 'required', 'integer', 'min:1',
                Rule::unique('collection_item_explore_monuments', 'position')
                    ->where('collection_item_id', $current?->collection_item_id)
                    ->ignore($current?->id),
            ],
            'backward_compatibility' => ['sometimes', 'required', 'string', 'max:255'],
            ...$this->exploreMonumentRules(),
            'include' => ['sometimes', 'string', new IncludeRule('collection_item_explore_monument')],
        ];
    }
}
