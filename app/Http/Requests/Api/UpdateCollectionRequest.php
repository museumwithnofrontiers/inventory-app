<?php

namespace App\Http\Requests\Api;

use App\Models\Collection;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCollectionRequest extends FormRequest
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
        /** @var Collection|null $collection */
        $collection = $this->route('collection');

        return [
            'internal_name' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('collections', 'internal_name')->ignore($collection?->id)],
            'type' => ['sometimes', 'required', 'in:collection,exhibition,gallery,theme,exhibition trail,itinerary,location,subtheme,region'],
            'purpose' => [
                'nullable',
                'string',
                Rule::in(Collection::PURPOSES),
                // Section anchors ('*-root') are unique per context
                Rule::when(
                    str_ends_with((string) $this->input('purpose'), '-root'),
                    [
                        Rule::unique('collections', 'purpose')
                            ->where('context_id', $this->input('context_id', $collection?->context_id))
                            ->ignore($collection?->id),
                    ]
                ),
            ],
            'language_id' => ['sometimes', 'required', 'string', 'size:3', 'exists:languages,id'],
            'context_id' => ['sometimes', 'required', 'string', 'exists:contexts,id'],
            'parent_id' => ['nullable', 'string', 'exists:collections,id'],
            'display_order' => ['nullable', 'integer', 'min:0'],
            'backward_compatibility' => ['nullable', 'string', 'max:255'],
            'extra' => ['nullable', 'array'],
            'cover_item_id' => ['nullable', 'uuid', 'exists:items,id'],
            'days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'draft' => ['sometimes', 'boolean'],
        ];
    }
}
