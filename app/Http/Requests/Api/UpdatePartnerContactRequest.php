<?php

namespace App\Http\Requests\Api;

use App\Models\PartnerContact;
use App\Rules\IncludeRule;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePartnerContactRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $contact = $this->route('partnerContact');
        $current = $contact instanceof PartnerContact ? $contact : null;

        $rules = [
            'id' => ['prohibited'],
            // A contact stays with its partner: another partner's contact is another record.
            'partner_id' => ['prohibited'],
            'display_order' => [
                'sometimes', 'required', 'integer', 'min:1',
                Rule::unique('partner_contacts', 'display_order')
                    ->where('partner_id', $current?->partner_id)
                    ->ignore($current?->id),
            ],
            'backward_compatibility' => ['nullable', 'string', 'max:255'],
            'include' => ['sometimes', 'string', new IncludeRule('partner_contact')],
        ];
        foreach (PartnerContact::TEXT_FIELDS as $field) {
            $rules[$field] = ['nullable', 'string'];
        }

        return $rules;
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'display_order.unique' => 'This partner already has a contact at this position.',
        ];
    }
}
