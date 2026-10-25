<?php

namespace App\Http\Requests\Api;

use App\Models\Item;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateItemRequest extends FormRequest
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
        return [
            'id' => ['prohibited'],
            'internal_name' => ['sometimes', 'required', 'string', 'max:255'],
            'backward_compatibility' => ['sometimes', 'nullable', 'string', 'max:255'],
            'type' => ['sometimes', 'required', 'in:object,monument,detail,picture'],
            'parent_id' => ['sometimes', 'nullable', 'uuid', 'exists:items,id'],
            'display_order' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'country_id' => ['sometimes', 'nullable', 'string', 'size:3', 'exists:countries,id'],
            'partner_id' => ['sometimes', 'nullable', 'uuid', 'exists:partners,id'],
            'project_id' => ['sometimes', 'nullable', 'uuid', 'exists:projects,id'],
            'collection_id' => ['sometimes', 'nullable', 'uuid', 'exists:collections,id'],
            'owner_reference' => ['sometimes', 'nullable', 'string', 'max:255'],
            'mwnf_reference' => ['sometimes', 'nullable', 'string', 'max:255'],
            // A signed INT column: legacy dates the Paleolithic from -300000.
            'start_date' => ['sometimes', 'nullable', 'integer', 'min:-2147483648', 'max:2147483647'],
            'end_date' => ['sometimes', 'nullable', 'integer', 'min:-2147483648', 'max:2147483647', 'gte:start_date'],
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (\Illuminate\Contracts\Validation\Validator $validator) {
            // Prevent circular references
            /** @var Item|null $item */
            $item = $this->route('item');
            $parentId = $this->input('parent_id');

            if ($this->has('parent_id') && $parentId !== null && $item !== null && $parentId === $item->id) {
                $validator->errors()->add('parent_id', 'An item cannot be its own parent.');
            }
        });
    }
}
