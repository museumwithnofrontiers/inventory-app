<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Api\Concerns\ValidatesCollectionItemExploreMonumentFields;
use App\Rules\IncludeRule;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCollectionItemExploreMonumentRequest extends FormRequest
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
        return [
            'id' => ['prohibited'],
            'collection_item_id' => ['required', 'uuid', 'exists:collection_item,id'],
            'position' => [
                'required', 'integer', 'min:1',
                Rule::unique('collection_item_explore_monuments', 'position')
                    ->where('collection_item_id', $this->input('collection_item_id')),
            ],
            'backward_compatibility' => ['required', 'string', 'max:255'],
            ...$this->exploreMonumentRules(),
            'include' => ['sometimes', 'string', new IncludeRule('collection_item_explore_monument')],
        ];
    }
}
