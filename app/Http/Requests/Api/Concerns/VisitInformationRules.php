<?php

namespace App\Http\Requests\Api\Concerns;

use App\Models\VisitInformation;
use App\Rules\IncludeRule;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/**
 * The validation shared by the Store and Update visit information requests:
 * exactly one owner (an item, a collection or a partner), one text per owner,
 * language and context, and the texts as written.
 */
trait VisitInformationRules
{
    /**
     * @param  VisitInformation|null  $current  The record being updated, if any.
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    protected function visitInformationRules(bool $creating, ?VisitInformation $current = null): array
    {
        $required = $creating ? 'required' : 'sometimes';
        $owner = $this->ownerColumn($current);

        $unique = Rule::unique('visit_information', 'language_id')
            ->where('context_id', $this->input('context_id', $current?->context_id));
        if ($owner !== null) {
            $unique->where($owner, $this->input($owner, $current?->getAttribute($owner)));
        }
        if ($current !== null) {
            $unique->ignore($current->id);
        }

        $rules = [
            'id' => ['prohibited'],
            'item_id' => ['nullable', 'uuid', 'exists:items,id', 'prohibits:collection_id,partner_id'],
            'collection_id' => ['nullable', 'uuid', 'exists:collections,id', 'prohibits:item_id,partner_id'],
            'partner_id' => ['nullable', 'uuid', 'exists:partners,id', 'prohibits:item_id,collection_id'],
            'language_id' => [$required, 'string', 'size:3', 'exists:languages,id', $unique],
            'context_id' => [$required, 'uuid', 'exists:contexts,id'],
            'backward_compatibility' => ['nullable', 'string', 'max:255'],
            'extra' => ['nullable', 'array'],
            'include' => ['sometimes', 'string', new IncludeRule('visit_information')],
        ];
        if ($creating) {
            $rules['item_id'][] = 'required_without_all:collection_id,partner_id';
        } else {
            // The owner is set once: another owner is another visit information.
            foreach (VisitInformation::OWNER_COLUMNS as $column) {
                $rules[$column] = ['prohibited'];
            }
        }
        foreach (VisitInformation::TEXT_FIELDS as $field) {
            $rules[$field] = ['nullable', 'string'];
        }

        return $rules;
    }

    /**
     * The owner column the request names, else the record's own.
     */
    private function ownerColumn(?VisitInformation $current): ?string
    {
        foreach (VisitInformation::OWNER_COLUMNS as $column) {
            if ($this->filled($column)) {
                return $column;
            }
        }
        foreach (VisitInformation::OWNER_COLUMNS as $column) {
            if ($current?->getAttribute($column) !== null) {
                return $column;
            }
        }

        return null;
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'language_id.unique' => 'This owner already has visit information in this language and context.',
            'item_id.required_without_all' => 'Visit information belongs to an item, a collection or a partner.',
        ];
    }
}
