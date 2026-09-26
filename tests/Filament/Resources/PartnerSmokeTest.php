<?php

namespace Tests\Filament\Resources;

use App\Enums\ItemType;
use App\Filament\Resources\PartnerResource\Pages\ViewPartner;
use App\Filament\Resources\PartnerResource\RelationManagers\OwnedItemsRelationManager;
use App\Models\Item;
use App\Models\Partner;
use Illuminate\Database\Eloquent\Factories\Sequence;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class PartnerSmokeTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_partner_resource_handles_a_ten_thousand_owned_item_dataset(): void
    {
        $user = $this->createViewOnlyUser();
        $partner = Partner::factory()->create(['internal_name' => 'Jordan Museum']);
        $this->seedOwnedItems($partner);

        DB::flushQueryLog();
        DB::enableQueryLog();

        $response = $this->actingAs($user)->get("/admin/partners/{$partner->getKey()}");

        $response->assertOk();
        $this->assertLessThan(40, count(DB::getQueryLog()));
        $this->assertLessThan(2 * 1024 * 1024, strlen($response->getContent()));
        DB::disableQueryLog();

        $this->setCurrentPanel();

        $expectedFirstPage = Item::query()
            ->where('partner_id', $partner->id)
            ->orderBy('internal_name')
            ->limit(25)
            ->get();

        $target = Item::query()
            ->where('partner_id', $partner->id)
            ->where('internal_name', 'Owned Item 09999')
            ->firstOrFail();

        $paginatedAway = Item::query()
            ->where('partner_id', $partner->id)
            ->where('internal_name', 'Owned Item 00025')
            ->firstOrFail();

        $nonTarget = Item::query()
            ->where('partner_id', $partner->id)
            ->where('internal_name', 'Owned Item 00000')
            ->firstOrFail();

        Livewire::actingAs($user)
            ->test(OwnedItemsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => ViewPartner::class,
            ])
            ->assertCanSeeTableRecords($expectedFirstPage, inOrder: true)
            ->assertCanNotSeeTableRecords([$paginatedAway])
            ->searchTable('Owned Item 09999')
            ->assertCanSeeTableRecords([$target])
            ->assertCanNotSeeTableRecords([$nonTarget]);
    }

    public function test_partner_create_and_edit_forms_do_not_preload_large_option_datasets(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create(['internal_name' => 'Test Partner']);
        $this->seedOwnedItems($partner);

        DB::flushQueryLog();
        DB::enableQueryLog();

        // Create form must open without loading all items (monument_item select) or all partners/projects/countries.
        $response = $this->actingAs($user)->get('/admin/partners/create');
        $response->assertOk();
        $createQueryCount = count(DB::getQueryLog());

        DB::flushQueryLog();

        // Edit form must also open without loading the full item/project/country datasets.
        $response = $this->actingAs($user)->get("/admin/partners/{$partner->getKey()}/edit");
        $response->assertOk();
        $editQueryCount = count(DB::getQueryLog());

        DB::disableQueryLog();

        // With preloads removed, query counts must stay well below the 10 000-row item count.
        $this->assertLessThan(50, $createQueryCount, "Create form issued too many queries ($createQueryCount), likely still preloading monument_item/country/project datasets.");
        $this->assertLessThan(50, $editQueryCount, "Edit form issued too many queries ($editQueryCount), likely still preloading monument_item/country/project datasets.");
    }

    protected function seedOwnedItems(Partner $partner): void
    {
        $timestamp = Carbon::now();

        $rows = Item::factory()
            ->count(10_000)
            ->sequence(fn (Sequence $sequence): array => [
                'partner_id' => $partner->id,
                'internal_name' => sprintf('Owned Item %05d', $sequence->index),
                'backward_compatibility' => sprintf('itm-%05d', $sequence->index),
                'type' => ItemType::OBJECT,
            ])
            ->make()
            ->map(fn (Item $item): array => [
                ...$item->getAttributes(),
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ])
            ->all();

        foreach (array_chunk($rows, 1000) as $chunk) {
            Item::query()->insert($chunk);
        }
    }
}
