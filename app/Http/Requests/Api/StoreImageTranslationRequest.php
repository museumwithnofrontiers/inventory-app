<?php

namespace App\Http\Requests\Api;

use App\Support\Images\AttachedImageRegistry;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreImageTranslationRequest extends FormRequest
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
        return [
            'id' => ['prohibited'],
            'image_type' => ['required', 'string', Rule::in(array_keys(AttachedImageRegistry::morphAliases()))],
            'image_id' => ['required', 'uuid'],
            'language_id' => [
                'required', 'string', 'size:3', 'exists:languages,id',
                Rule::unique('image_translations')->where(fn (Builder $query): Builder => $query
                    ->where('image_type', $this->string('image_type')->value())
                    ->where('image_id', $this->string('image_id')->value())),
            ],
            'caption' => ['nullable', 'string'],
            'name' => ['nullable', 'string'],
            'date' => ['nullable', 'string'],
            'museum' => ['nullable', 'string'],
            'location' => ['nullable', 'string'],
            'backward_compatibility' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * The image must exist in the table its kind names.
     *
     * @return array<int, \Closure(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $class = AttachedImageRegistry::morphAliases()[$this->string('image_type')->value()] ?? null;
                if ($class !== null && ! $class::query()->whereKey($this->string('image_id')->value())->exists()) {
                    $validator->errors()->add('image_id', 'The image does not exist.');
                }
            },
        ];
    }
}
