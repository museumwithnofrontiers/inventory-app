<?php

namespace App\Http\Requests\Api;

use App\Models\CollectionTranslation;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCollectionTranslationRequest extends FormRequest
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
        /** @var CollectionTranslation|null $collectionTranslation */
        $collectionTranslation = $this->route('collectionTranslation');

        // Only apply uniqueness validation if updating the unique key fields
        $uniqueRule = Rule::unique('collection_translations')->ignore($collectionTranslation?->id);

        // Build where clauses for unique constraint check
        // Use existing values if not being updated
        if ($this->has('language_id') || $this->has('context_id')) {
            $uniqueRule->where(function (Builder $query) use ($collectionTranslation) {
                $query->where('language_id', $this->input('language_id', $collectionTranslation?->language_id))
                    ->where('context_id', $this->input('context_id', $collectionTranslation?->context_id));
            });
        }

        return [
            'id' => ['prohibited'],
            'collection_id' => [
                'sometimes',
                'uuid',
                'exists:collections,id',
                $uniqueRule,
            ],
            'language_id' => ['sometimes', 'string', 'size:3', 'exists:languages,id'],
            'context_id' => ['sometimes', 'uuid', 'exists:contexts,id'],
            'title' => ['sometimes', 'string', 'max:255'],
            'subtitle' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'introduction' => ['nullable', 'string'],
            'quote' => ['nullable', 'string'],
            'duration' => ['nullable', 'string', 'max:255'],
            'url' => ['nullable', 'url', 'max:2048'],
            'backward_compatibility' => ['nullable', 'string', 'max:255'],
            'extra' => ['nullable', 'json'],
        ];
    }
}
