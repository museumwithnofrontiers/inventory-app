<?php

namespace App\Filament\Concerns;

use App\Filament\Support\ResourceCreateUrl;
use BackedEnum;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;

/**
 * Pre-fills a Filament CreateRecord page's form from whitelisted query-string
 * parameters (M7 epic #1871, story A0.3).
 *
 * This is the mechanism every A1 has-many story and A3.1's translation
 * stories rely on: a relation manager's `Create` header action navigates to
 * the child Resource's create page with the owning foreign key (and
 * sometimes a fixed value like `type`) in the query string, via
 * {@see ResourceCreateUrl}. This trait is what turns
 * that query string back into a filled form.
 *
 * Locked convention:
 *  - Only {@see ResourceCreateUrl::QUERY_KEYS} are ever read; a page declares
 *    the subset it accepts, and what each one refers to, via
 *    {@see self::queryPrefillFields()}. Anything outside that master set is
 *    ignored even if a page's map mentions it, so a typo can never smuggle an
 *    arbitrary key into the form.
 *  - A key mapped to a Model class-string is treated as that model's primary
 *    key: the record must exist AND be `view`-able by the signed-in user
 *    (the model's own Tier-3 policy, via `can('view', $record)`) or the
 *    value is dropped.
 *  - A key mapped to a BackedEnum class-string (e.g. `type` => ItemType) must
 *    be one of that enum's values or the value is dropped.
 *  - A missing, unknown or non-viewable value never errors: it simply isn't
 *    added to the prefill, so the form falls back to its normal clean state
 *    for that field.
 *
 * Applied by overriding nothing at the call site beyond `use` and declaring
 * `queryPrefillFields()` — it hooks in via `afterFill()`, which Filament's
 * `CreateRecord::fillForm()` already calls (through `callHook()`) right after
 * its own default `$this->form->fill()`. Merging the resolved values onto the
 * form's current raw state (rather than replacing it) and re-filling keeps
 * every other field's default, and re-running hydration re-fires
 * `afterStateHydrated()` so dependent fields still react to the prefilled
 * values.
 */
trait PrefillsCreateFormFromQuery
{
    /**
     * The keys this page accepts, and what each one refers to.
     *
     * @return array<string, class-string<Model>|class-string<BackedEnum>>
     */
    abstract protected function queryPrefillFields(): array;

    protected function afterFill(): void
    {
        $prefill = $this->resolveQueryPrefill();

        if ($prefill === []) {
            return;
        }

        $currentState = $this->form->getRawState();
        $currentState = is_array($currentState) ? $currentState : $currentState->toArray();

        $this->form->fill([...$currentState, ...$prefill]);
    }

    /**
     * @return array<string, string>
     */
    private function resolveQueryPrefill(): array
    {
        $resolved = [];

        /** @var array<string, class-string<Model>|class-string<BackedEnum>> $fields */
        $fields = Arr::only($this->queryPrefillFields(), ResourceCreateUrl::QUERY_KEYS);

        foreach ($fields as $key => $type) {
            $raw = request()->query($key);

            if (! is_string($raw) || $raw === '') {
                continue;
            }

            $value = $this->resolveQueryPrefillValue($type, $raw);

            if ($value !== null) {
                $resolved[$key] = $value;
            }
        }

        return $resolved;
    }

    /**
     * @param  class-string<Model>|class-string<BackedEnum>  $type
     */
    private function resolveQueryPrefillValue(string $type, string $raw): ?string
    {
        if (is_subclass_of($type, BackedEnum::class)) {
            return $type::tryFrom($raw) !== null ? $raw : null;
        }

        if (is_subclass_of($type, Model::class)) {
            $record = $type::query()->find($raw);

            if (! $record instanceof Model) {
                return null;
            }

            $user = Auth::user();

            return ($user !== null && $user->can('view', $record)) ? $raw : null;
        }

        return null;
    }
}
