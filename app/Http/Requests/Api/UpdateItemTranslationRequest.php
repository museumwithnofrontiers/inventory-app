<?php

namespace App\Http\Requests\Api;

use App\Models\ItemTranslation;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateItemTranslationRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        /** @var ItemTranslation|null $itemTranslation */
        $itemTranslation = $this->route('itemTranslation');

        // Only apply uniqueness validation if updating the unique key fields
        $uniqueRule = Rule::unique('item_translations')->ignore($itemTranslation?->id);

        // Build where clauses for unique constraint check
        // Use existing values if not being updated
        if ($this->has('language_id') || $this->has('context_id')) {
            $uniqueRule->where(function (Builder $query) use ($itemTranslation) {
                $query->where('language_id', $this->input('language_id', $itemTranslation?->language_id))
                    ->where('context_id', $this->input('context_id', $itemTranslation?->context_id));
            });
        }

        return [
            'id' => ['prohibited'],
            'item_id' => [
                'sometimes',
                'uuid',
                'exists:items,id',
                $uniqueRule,
            ],
            'language_id' => ['sometimes', 'string', 'size:3', 'exists:languages,id'],
            'context_id' => ['sometimes', 'uuid', 'exists:contexts,id'],
            'name' => ['sometimes', 'string', 'max:255'],
            'alternate_name' => ['nullable', 'string'],
            'description' => ['sometimes', 'string'],
            'type' => ['nullable', 'string'],
            'holder' => ['nullable', 'string'],
            'owner' => ['nullable', 'string'],
            'initial_owner' => ['nullable', 'string'],
            'dates' => ['nullable', 'string'],
            'location' => ['nullable', 'string'],
            'dimensions' => ['nullable', 'string'],
            'place_of_production' => ['nullable', 'string'],
            'method_for_datation' => ['nullable', 'string'],
            'method_for_provenance' => ['nullable', 'string'],
            'provenance' => ['nullable', 'string'],
            'obtention' => ['nullable', 'string'],
            'bibliography' => ['nullable', 'string'],
            'author_id' => ['nullable', 'uuid', 'exists:authors,id'],
            'text_copy_editor_id' => ['nullable', 'uuid', 'exists:authors,id'],
            'translator_id' => ['nullable', 'uuid', 'exists:authors,id'],
            'translation_copy_editor_id' => ['nullable', 'uuid', 'exists:authors,id'],
            'backward_compatibility' => ['nullable', 'string', 'max:255'],
            'extra' => ['nullable', 'json'],
        ];
    }
}
