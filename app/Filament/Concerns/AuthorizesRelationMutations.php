<?php

namespace App\Filament\Concerns;

use Filament\Actions\Action;
use Filament\Actions\AssociateAction;
use Filament\Actions\AttachAction;
use Filament\Actions\DetachAction;
use Filament\Actions\DetachBulkAction;
use Filament\Actions\DissociateAction;
use Filament\Actions\DissociateBulkAction;
use Illuminate\Auth\Access\Response;
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
 * policy of its own (Link, ItemDocument, the `*Image` models, and
 * pivot-only relations such as tags/artists/dynasties) has nothing
 * further to check, so host `update` alone governs it.
 *
 * These hooks are Filament's `get*AuthorizationResponse()` methods, which its
 * own `can*()` methods and built-in actions read (Filament 4 no longer calls a
 * `can*()` override). They only govern Filament's own built-in actions
 * (CreateAction, EditAction, DeleteAction, AttachAction, DetachAction,
 * AssociateAction, DissociateAction and their bulk variants). A relation manager that defines
 * a custom `Action::make(...)` for a mutation (e.g. BaseImagesRelationManager's
 * `attach`/`detach`, or a `Action::make('editTranslation')` link to another
 * Resource's edit page) must gate it explicitly with `hostRecordCanBeUpdated()`
 * (and, where relevant, the related record's own policy) via `->visible()`.
 */
trait AuthorizesRelationMutations
{
    protected function getCreateAuthorizationResponse(): Response
    {
        return $this->respond($this->hostRecordCanBeUpdated()
            && $this->relatedEntityAllows('create', $this->getTable()->getModel()));
    }

    protected function getEditAuthorizationResponse(Model $record): Response
    {
        return $this->respond($this->hostRecordCanBeUpdated()
            && $this->relatedEntityAllows('update', $record));
    }

    protected function getDeleteAuthorizationResponse(Model $record): Response
    {
        return $this->respond($this->hostRecordCanBeUpdated()
            && $this->relatedEntityAllows('delete', $record));
    }

    protected function getDeleteAnyAuthorizationResponse(): Response
    {
        return $this->respond($this->hostRecordCanBeUpdated()
            && $this->relatedEntityAllows('deleteAny', $this->getTable()->getModel()));
    }

    protected function getAttachAuthorizationResponse(): Response
    {
        return $this->respond($this->hostRecordCanBeUpdated());
    }

    protected function getDetachAuthorizationResponse(Model $record): Response
    {
        return $this->respond($this->hostRecordCanBeUpdated());
    }

    protected function getDetachAnyAuthorizationResponse(): Response
    {
        return $this->respond($this->hostRecordCanBeUpdated());
    }

    /**
     * Reordering (a `reorderable()` table) rewrites the order of the host's
     * relation, like editing a pivot, so host `update` governs it.
     */
    protected function getReorderAuthorizationResponse(): Response
    {
        return $this->respond($this->hostRecordCanBeUpdated());
    }

    protected function getAssociateAuthorizationResponse(): Response
    {
        return $this->respond($this->hostRecordCanBeUpdated());
    }

    protected function getDissociateAuthorizationResponse(Model $record): Response
    {
        return $this->respond($this->hostRecordCanBeUpdated());
    }

    protected function getDissociateAnyAuthorizationResponse(): Response
    {
        return $this->respond($this->hostRecordCanBeUpdated());
    }

    /**
     * Filament 4 authorizes Attach, Detach, Associate and Dissociate (and
     * their bulk variants) with isReadOnly() alone, which this concern turns
     * off; Filament 3 asked canAttach() and the others. They go through the
     * host `update` check above again, as they did then. Every other built-in
     * action keeps Filament's mapping to the methods above.
     */
    public function getDefaultActionAuthorizationResponse(Action $action): ?Response
    {
        $record = $action->getRecord();

        return match (true) {
            $action instanceof AttachAction => $this->getAttachAuthorizationResponse(),
            $action instanceof DetachAction => $record instanceof Model
                ? $this->getDetachAuthorizationResponse($record)
                : $this->getDetachAnyAuthorizationResponse(),
            $action instanceof DetachBulkAction => $this->getDetachAnyAuthorizationResponse(),
            $action instanceof AssociateAction => $this->getAssociateAuthorizationResponse(),
            $action instanceof DissociateAction => $record instanceof Model
                ? $this->getDissociateAuthorizationResponse($record)
                : $this->getDissociateAnyAuthorizationResponse(),
            $action instanceof DissociateBulkAction => $this->getDissociateAnyAuthorizationResponse(),
            default => parent::getDefaultActionAuthorizationResponse($action),
        };
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
     * Whether $subject's own Tier-3 policy allows $ability, on top of the host
     * `update` the caller already required. A related model without a policy,
     * or a policy without that ability, denies: the policies are the only
     * authorization mechanism, and every model has one (App\Policies\DataPolicy).
     *
     * @param  Model|class-string<Model>  $subject
     */
    private function relatedEntityAllows(string $ability, Model|string $subject): bool
    {
        $class = is_string($subject) ? $subject : $subject::class;
        $policy = Gate::getPolicyFor($class);

        if ($policy === null || ! method_exists($policy, $ability)) {
            return false;
        }

        $user = auth()->user();

        return $user !== null && $user->can($ability, $subject);
    }

    private function respond(bool $allowed): Response
    {
        return $allowed ? Response::allow() : Response::deny();
    }
}
