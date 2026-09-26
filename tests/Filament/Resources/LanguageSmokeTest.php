<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\LanguageResource\Pages\ListLanguage;
use App\Models\Language;
use Illuminate\Database\Eloquent\Factories\Sequence;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class LanguageSmokeTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_language_resource_handles_a_ten_thousand_row_dataset(): void
    {
        $user = $this->createReferenceDataUser();
        $this->seedLanguages();

        DB::flushQueryLog();
        DB::enableQueryLog();

        $response = $this->actingAs($user)->get('/admin/languages');

        $response->assertOk();
        $this->assertLessThan(50, count(DB::getQueryLog()));
        $this->assertLessThan(2 * 1024 * 1024, strlen($response->getContent()));
        DB::disableQueryLog();

        $this->setCurrentPanel();

        $expectedFirstPage = Language::query()
            ->orderBy('internal_name')
            ->limit(10)
            ->get();

        $expectedSecondPage = Language::query()
            ->orderBy('internal_name')
            ->forPage(2, 10)
            ->get();

        $expectedSortedDescending = Language::query()
            ->orderByDesc('internal_name')
            ->limit(10)
            ->get();

        $target = Language::query()->where('internal_name', 'Language 09999')->firstOrFail();
        $nonTarget = Language::query()->where('internal_name', 'Language 00000')->firstOrFail();

        Livewire::actingAs($user)
            ->test(ListLanguage::class)
            ->assertCanSeeTableRecords($expectedFirstPage, inOrder: true)
            ->call('gotoPage', 2)
            ->assertCanSeeTableRecords($expectedSecondPage, inOrder: true)
            ->searchTable('Language 09999')
            ->assertCanSeeTableRecords([$target])
            ->assertCanNotSeeTableRecords([$nonTarget])
            ->searchTable(null)
            ->sortTable('internal_name', 'desc')
            ->assertCanSeeTableRecords($expectedSortedDescending, inOrder: true);
    }

    protected function seedLanguages(): void
    {
        $timestamp = Carbon::now();

        $rows = Language::factory()
            ->count(10_000)
            ->sequence(fn (Sequence $sequence): array => [
                'id' => $this->isoCodeFromIndex($sequence->index),
                'internal_name' => sprintf('Language %05d', $sequence->index),
                // 1296 = 36^2, which lets us cycle through all 2-character base-36 legacy codes.
                'backward_compatibility' => str_pad(base_convert($sequence->index % 1296, 10, 36), 2, '0', STR_PAD_LEFT),
                'is_default' => $sequence->index === 0,
            ])
            ->make()
            ->map(fn (Language $language): array => [
                ...$language->getAttributes(),
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ])
            ->all();

        foreach (array_chunk($rows, 1000) as $chunk) {
            Language::query()->insert($chunk);
        }
    }

    protected function isoCodeFromIndex(int $index): string
    {
        return str_pad(strtolower(base_convert($index, 10, 36)), 3, '0', STR_PAD_LEFT);
    }
}
