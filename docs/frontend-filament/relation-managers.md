---
layout: default
title: Relation Managers
nav_order: 2
parent: Filament Admin Frontend
---

# Relation Managers

Every relation manager in the `/admin` panel follows one convention per kind of relation, one authorization rule and one select rule. Together they let people add, edit and remove every relation from a record's page, safely for tables of tens of thousands of rows. `tests/Filament/RelationManagerConventionTest.php` enforces all of it on every manager registered on the panel, so a manager that drifts fails CI.

{: .note }
> The rules come from the M7 milestone ([scoping story #1864](https://github.com/museumwithnofrontiers/inventory-app/issues/1864), [epic A0 #1871](https://github.com/museumwithnofrontiers/inventory-app/issues/1871)). The two conventions below are quoted from the epic.

## Has-many convention

A has-many relation is one where the child row carries the foreign key, for example `collections.parent_id`, `items.parent_id` or `items.partner_id`.

> **Header:** `Create` (navigates to the child Resource's Create page with the FK pre-filled) · `Attach existing` (AssociateAction, searchable, cycle-guarded for self-relations).
> **Row, in this order:** `View` · `Edit` (navigates to the child Resource's Edit page) · `Detach` (clears the FK, record survives) · `Delete` (confirm; child's own policy).
> **Bulk:** `Detach`.

In code the action names are: header `create`, `associate`; row `view`, `edit`, `dissociate`, `delete`; bulk `dissociate`.

**Required parent.** When the foreign key is `NOT NULL` (for example `timeline_events.timeline_id`), the child can't exist without its owner. Such a manager has no `Attach existing` and no `Detach`: the header has only `create`, the row has `view`, `edit` and `delete`, and there are no bulk actions. The child moves to another owner through its own Edit form.

Build a has-many manager with `App\Filament\Concerns\HasManyChildActions`. It needs three hooks:

- `hasManyChildResource()`: the child's Resource class;
- `hasManyChildForeignKey()`: the foreign key column;
- `hasManyChildRecordSelectEntity()`: the `RecordSelect` entity for `Attach existing`.

Optional hooks add pre-fill values (`hasManyChildCreateExtra()`), narrow or cycle-guard the associate select (`hasManyChildAssociateScope()`), and add fields to the associate form (`hasManyChildAssociateFormExtra()`). See `CollectionResource\RelationManagers\ChildCollectionsRelationManager` and `ItemResource\RelationManagers\BaseChildItemsRelationManager`.

## Pivot convention

A pivot relation goes through a link table, for example `collection_item`, `collection_partner`, `timeline_event_item`, or the Item's tags, artists, workshops and dynasties.

> **Header:** `Attach` (searchable record select + the pivot's metadata fields).
> **Row:** `View` (related record) · `Edit` (modal on the pivot metadata only) · `Detach`.
> **Bulk:** `Detach`.
> Pivot `extra` uses `ExtraJsonField`; pivot `backward_compatibility` is shown hidden-by-default and never editable (importer-owned). Both sides of a pivot offer the same actions.

In code the action names are: header `attach`; row `view`, then `edit` when the pivot has editable metadata, then `detach`; bulk `detach`.

Build a pivot manager with `App\Filament\Concerns\PivotRelationActions`:

- `pivotAttachAction($entity, $pivotFields, $scope)`
- `pivotViewAction($relatedResource)`
- `pivotEditAction($pivotFields)`
- `pivotDetachAction()`
- `pivotDetachBulkAction()`

See `ItemResource\RelationManagers\TagsRelationManager`.

## Other kinds

A few managers fit neither convention. Each follows a fixed shape of its own.

- **Translations** of a record that has a `*TranslationResource`: the header has `create`, which navigates to that Resource's Create page, and `createDefaultTranslation`. The row has `viewTranslation`, `editTranslation` (which navigates), a link back to the parent record, and `delete`. Extend `App\Filament\Resources\RelationManagers\BaseOwnerTranslationsRelationManager`.
- **Inline records** that have no Resource of their own keep modal forms, because there is no page to navigate to:
  - media: header `create`; row `edit`, `delete`;
  - documents: header `upload`; row `download`, `edit`, `delete`. Uploads go through the queued [document upload pipeline]({{ '/frontend-filament/document-upload' | relative_url }}).
- **Pinned** managers are the remaining ones:
  - the images managers;
  - the Item's incoming and outgoing links;
  - sibling translations;
  - translations of reference data and of records without a `*TranslationResource`;
  - the Project's derived collections;
  - the Role's permissions and users.

  The convention test records their exact actions as a snapshot. Changing one means updating the snapshot on purpose. They still follow the authorization, select and pagination rules.

## Authorization rule

> `Attach`/`Detach`/`Edit`-pivot/`Create`-in-modal/`Delete`-in-modal require `update` on the host record via the existing policies; `Create`/`Edit`/`Delete` of a child entity additionally require that entity's own policy `create`/`update`/`delete`. Every mutating action is hidden when denied.

Every relation manager uses `App\Filament\Concerns\AuthorizesRelationMutations`, which applies this rule to Filament's built-in actions. There are no new policy classes: the existing `App\Policies\*` decide. Filament calls the record a manager sits on its "owner record"; that is only Filament's name for the host record, not an ownership model, since every record belongs to MWNF.

- **Custom actions** (an `Action::make(...)` that changes data) are not covered automatically. Gate each one with `->visible(fn (): bool => $this->hostRecordCanBeUpdated())`.
- **View pages.** Filament makes relation managers read-only on a resource's View page by default. The concern turns that off for the managers that use it, because every link in the panel lands on the View page. Each action still needs `update` on the host record. Never flip the panel-wide switch instead.

## Select rule

> Every record select (attach, associate, parent) is built by one helper: server-side search on `id`, `internal_name`, `backward_compatibility`, labels from the `*DisplayLabel` helpers, ordered, capped at 50, never preloaded.

That helper is `App\Filament\Support\RecordSelect`:

- `RecordSelect::recordSelectFor($action, RecordSelect::ITEMS, $scope)` adapts an `AttachAction` or `AssociateAction`. The optional `$scope` closure narrows the options, for example to exclude the record itself.
- `RecordSelect::forItems()`, `forCollections()`, `forPartners()` and the other `for*()` factories return a plain `Select` for a form field, such as a parent select on a Create page.
- `excludingAncestorsOf()` and `excludingDescendantsOf()` are the cycle guards for self-relations such as parent collections.

Entities without `internal_name` search what they have instead. Dynasties search `id` and `backward_compatibility`. Permissions search `name` and `guard_name`, and their label shows the guard.

A manager never calls `->preload()`, `->recordSelect()` or `->recordSelectSearchColumns()`. A `Select` over an enum or a small reference table, such as a pivot's `level`, a media `type` or a language, is not a record select and stays allowed.

## Navigating to Create pages

A `Create` action that navigates builds its URL with `App\Filament\Support\ResourceCreateUrl::for(ChildResource::class, ['parent_id' => $id])`. The target Create page uses `App\Filament\Concerns\PrefillsCreateFormFromQuery` and lists the fields it accepts in `queryPrefillFields()`. Only the keys in `ResourceCreateUrl::QUERY_KEYS` are ever read. A new pre-fill key goes into that list, with a test.

## Other shared rules

- Pagination is `[25, 50, 100]` with 25 as the default, and never `all`.
- Test with the helpers in `Tests\Filament\Concerns\InteractsWithAdminPanel`:
  - `createCrudUser()`, `createViewOnlyUser()`, `createReferenceDataUser()` and `createRoleManagerUser()`;
  - `setCurrentPanel()`.
- Mount a manager on its resource's **View** page, where users land.
- Filament's table test helpers use a Model you pass exactly as it is, without its pivot. Pass record **keys** to row assertions such as `assertTableActionHidden('detach', $record->getKey())`.

## Checklist for a new relation manager

1. **Pick the kind:** has-many (or required-parent has-many), pivot, translations or inline. Only fall back to pinned when none fits, and say why in the pull request.
2. **Build it with the matching helper:** `HasManyChildActions`, `PivotRelationActions` or `BaseOwnerTranslationsRelationManager`. Use the exact action names and order listed above.
3. **Add `use AuthorizesRelationMutations;`** and gate every custom mutating action with `hostRecordCanBeUpdated()`.
4. **Build every attach, associate and parent select with `RecordSelect`.** If the related model has no entity yet, add one to `RecordSelect` with its own test in `tests/Filament/Support/RecordSelectTest.php`.
5. **Navigate for records that have a Resource:** create and edit them on that Resource's pages. Pre-fill with `ResourceCreateUrl` and `PrefillsCreateFormFromQuery`. Modals are only for pivot metadata and records without a Resource.
6. **Set pagination** to `->paginated([25, 50, 100])->defaultPaginationPageOption(25)`.
7. **Register it in `RelationManagerConventionTest`:**
   - classify it in `CLASSIFICATION`;
   - raise the expected manager count in `test_the_admin_panel_registers_the_expected_number_of_relation_managers`;
   - don't add it to `PENDING` or `PINNED_PENDING`: a new manager complies from day one.
8. **Test the authorization on the View page:** a view-only user sees no mutating action, and a user with `update` on the host record sees every one.
9. **Run the checks:** pint, PHPStan (CI doesn't run it) and `php artisan test --testsuite=Filament`, all in Docker.
