<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\CountryResource\Pages\ListCountry;
use App\Models\Country;
use Illuminate\Database\Eloquent\Factories\Sequence;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class CountrySmokeTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_country_resource_handles_a_ten_thousand_row_dataset(): void
    {
        $user = $this->createReferenceDataUser();
        $this->seedCountries();

        DB::flushQueryLog();
        DB::enableQueryLog();

        $response = $this->actingAs($user)->get('/admin/countries');

        $response->assertOk();
        $this->assertLessThan(50, count(DB::getQueryLog()));
        $this->assertLessThan(2 * 1024 * 1024, strlen($response->getContent()));
        DB::disableQueryLog();

        $this->setCurrentPanel();

        $expectedFirstPage = Country::query()
            ->orderBy('internal_name')
            ->limit(10)
            ->get();

        $expectedSecondPage = Country::query()
            ->orderBy('internal_name')
            ->forPage(2, 10)
            ->get();

        $expectedSortedDescending = Country::query()
            ->orderByDesc('internal_name')
            ->limit(10)
            ->get();

        $target = Country::query()->where('internal_name', 'Country 09999')->firstOrFail();
        $nonTarget = Country::query()->where('internal_name', 'Country 00000')->firstOrFail();

        Livewire::actingAs($user)
            ->test(ListCountry::class)
            ->assertCanSeeTableRecords($expectedFirstPage, inOrder: true)
            ->call('gotoPage', 2)
            ->assertCanSeeTableRecords($expectedSecondPage, inOrder: true)
            ->searchTable('Country 09999')
            ->assertCanSeeTableRecords([$target])
            ->assertCanNotSeeTableRecords([$nonTarget])
            ->searchTable(null)
            ->sortTable('internal_name', 'desc')
            ->assertCanSeeTableRecords($expectedSortedDescending, inOrder: true);
    }

    protected function seedCountries(): void
    {
        $timestamp = Carbon::now();

        $rows = Country::factory()
            ->count(10_000)
            ->sequence(fn (Sequence $sequence): array => [
                'id' => $this->isoCodeFromIndex($sequence->index),
                'internal_name' => sprintf('Country %05d', $sequence->index),
                // 1296 = 36^2, which lets us cycle through all 2-character base-36 legacy codes.
                'backward_compatibility' => str_pad(base_convert($sequence->index % 1296, 10, 36), 2, '0', STR_PAD_LEFT),
            ])
            ->make()
            ->map(fn (Country $country): array => [
                ...$country->getAttributes(),
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ])
            ->all();

        foreach (array_chunk($rows, 1000) as $chunk) {
            Country::query()->insert($chunk);
        }
    }

    protected function isoCodeFromIndex(int $index): string
    {
        return str_pad(strtolower(base_convert($index, 10, 36)), 3, '0', STR_PAD_LEFT);
    }
}
