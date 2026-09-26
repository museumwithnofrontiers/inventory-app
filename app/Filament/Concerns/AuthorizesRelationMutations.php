<?php

namespace App\Filament\Concerns;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Gate;

/**
 * Shared Tier-3 authorization for Filament relation managers (M7 epic #1871).
 *
 * Locked convention: every mutation a relation manager can perform requires
 * `update` on the HOST record (the manager's owner record, i.e. the Collection,
 * Item, Partner or TimelineEvent being edited) via its existing policy.
 *
 * Attach/Detach/Associate/Dissociate never look at the related entity's own
 * policy: they only move a relationship, so host `update` is enough. Create,
 * Edit and Delete of a related entity that carries its own policy (e.g.
 * ItemTranslation, ItemItemLink) additionally require that entity's own
 * `create`/`update`/`delete`/`deleteAny` ability. A related entity with no
 * policy of its own (ItemMedia, ItemDocument, the `*Image` models, and
 * pivot-only relations such as tags/artists/workshops/dynasties) has nothing
 * further to check, so host `update` alone governs it.
 *
 * These hooks only govern Filament's own built-in actions (CreateAction,
 * EditAction, DeleteAction, AttachAction, DetachAction, AssociateAction,
 * DissociateAction and their bulk variants). A relation manager that defines
 * a custom `Action::make(...)` for a mutation (e.g. BaseImagesRelationManager's
 * `attach`/`detach`, or a `Action::make('editTranslation')` link to another
 * Resource's edit page) must gate it explicitly with `hostRecordCanBeUpdated()`
 * (and, where relevant, the related record's own policy) via `->visible()`.
 */
trait AuthorizesRelationMutations
{
    protected function canCreate(): bool
    {
        return $this->hostRecordCanBeUpdated()
            && $this->relatedEntityAllows('create', $this->getTable()->getModel());
    }

    protected function canEdit(Model $record): bool
    {
        return $this->hostRecordCanBeUpdated()
            && $this->relatedEntityAllows('update', $record);
    }

    protected function canDelete(Model $record): bool
    {
        return $this->hostRecordCanBeUpdated()
            && $this->relatedEntityAllows('delete', $record);
    }

    protected function canDeleteAny(): bool
    {
        return $this->hostRecordCanBeUpdated()
            && $this->relatedEntityAllows('deleteAny', $this->getTable()->getModel());
    }

    protected function canAttach(): bool
    {
        return $this->hostRecordCanBeUpdated();
    }

    protected function canDetach(Model $record): bool
    {
        return $this->hostRecordCanBeUpdated();
    }

    protected function canDetachAny(): bool
    {
        return $this->hostRecordCanBeUpdated();
    }

    protected function canAssociate(): bool
    {
        return $this->hostRecordCanBeUpdated();
    }

    protected function canDissociate(Model $record): bool
    {
        return $this->hostRecordCanBeUpdated();
    }

    protected function canDissociateAny(): bool
    {
        return $this->hostRecordCanBeUpdated();
    }

    /**
     * M7 Story A0.6 (#1895): every entry point into a resource lands on its
     * View page (table `recordUrl` and every cross-resource link use
     * `getUrl('view')`), so Filament's own default — read-only relation
     * managers on View pages — hid Create/Edit/Delete everywhere a user
     * actually lands, leaving them reachable only via the Edit page. A
     * manager using this concern stays safe to unlock: every mutating action,
     * built-in or custom, is already gated on `hostRecordCanBeUpdated()`
     * above, so a view-only user (who fails that check) still sees none.
     */
    public function isReadOnly(): bool
    {
        return false;
    }

    /**
     * Whether the signed-in user may `update` this relation manager's owner
     * (host) record, via that record's own Tier-3 policy. Every mutating
     * action of the manager — built-in or custom — must be gated on this.
     */
    public function hostRecordCanBeUpdated(): bool
    {
        $user = auth()->user();

        return $user !== null && $user->can('update', $this->getOwnerRecord());
    }

    /**
     * Whether $subject's own Tier-3 policy allows $ability. Related entities
     * that don't have a policy of their own (or whose policy doesn't define
     * that ability) have nothing to check here, so this allows by default —
     * the caller has already required host `update`.
     *
     * @param  Model|class-string<Model>  $subject
     */
    private function relatedEntityAllows(string $ability, Model|string $subject): bool
    {
        $class = is_string($subject) ? $subject : $subject::class;
        $policy = Gate::getPolicyFor($class);

        if ($policy === null || ! method_exists($policy, $ability)) {
            return true;
        }

        $user = auth()->user();

        return $user !== null && $user->can($ability, $subject);
    }
}
