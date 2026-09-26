<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\GlossaryResource\Pages\ListGlossary;
use App\Models\Glossary;
use Illuminate\Database\Eloquent\Factories\Sequence;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class GlossarySmokeTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_glossary_resource_handles_a_ten_thousand_row_dataset(): void
    {
        $user = $this->createReferenceDataUser();
        $this->seedGlossaries();

        DB::flushQueryLog();
        DB::enableQueryLog();

        $response = $this->actingAs($user)->get('/admin/glossaries');

        $response->assertOk();
        $this->assertLessThan(50, count(DB::getQueryLog()));
        $this->assertLessThan(2 * 1024 * 1024, strlen($response->getContent()));
        DB::disableQueryLog();

        $this->setCurrentPanel();

        $expectedFirstPage = Glossary::query()
            ->orderBy('internal_name')
            ->limit(10)
            ->get();

        $expectedSecondPage = Glossary::query()
            ->orderBy('internal_name')
            ->forPage(2, 10)
            ->get();

        $expectedSortedDescending = Glossary::query()
            ->orderByDesc('internal_name')
            ->limit(10)
            ->get();

        $target = Glossary::query()->where('internal_name', 'Glossary 09999')->firstOrFail();
        $nonTarget = Glossary::query()->where('internal_name', 'Glossary 00000')->firstOrFail();

        Livewire::actingAs($user)
            ->test(ListGlossary::class)
            ->assertCanSeeTableRecords($expectedFirstPage, inOrder: true)
            ->call('gotoPage', 2)
            ->assertCanSeeTableRecords($expectedSecondPage, inOrder: true)
            ->searchTable('Glossary 09999')
            ->assertCanSeeTableRecords([$target])
            ->assertCanNotSeeTableRecords([$nonTarget])
            ->searchTable(null)
            ->sortTable('internal_name', 'desc')
            ->assertCanSeeTableRecords($expectedSortedDescending, inOrder: true);
    }

    protected function seedGlossaries(): void
    {
        $timestamp = Carbon::now();

        $rows = Glossary::factory()
            ->count(10_000)
            ->sequence(fn (Sequence $sequence): array => [
                'internal_name' => sprintf('Glossary %05d', $sequence->index),
                'backward_compatibility' => sprintf('g-%05d', $sequence->index),
            ])
            ->make()
            ->map(fn (Glossary $glossary): array => [
                ...$glossary->getAttributes(),
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ])
            ->all();

        foreach (array_chunk($rows, 1000) as $chunk) {
            Glossary::query()->insert($chunk);
        }
    }
}
