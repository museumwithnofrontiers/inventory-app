<?php

namespace Tests\Unit\Filament;

use App\Filament\Concerns\HasBackwardCompatibilityColumn;
use App\Filament\Concerns\HasInternalNameColumn;
use App\Filament\Concerns\HasTimestampsColumns;
use App\Filament\Concerns\HasUuidColumn;
use App\Filament\Support\EntityColor;
use App\Filament\Support\TranslationFormSchema;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Support\Colors\Color;
use Filament\Tables\Columns\TextColumn;
use Tests\TestCase;

class FilamentConventionSupportTest extends TestCase
{
    public function test_entity_color_resolves_tokens_and_palettes_from_config(): void
    {
        $this->assertSame('teal', EntityColor::token('projects'));
        $this->assertSame('blue', EntityColor::token('keyword'));
        $this->assertSame('gray', EntityColor::token('missing-entity'));
        $this->assertSame(Color::Teal, EntityColor::palette('projects'));
        $this->assertSame(Color::Blue, EntityColor::palette('keyword'));
        $this->assertSame(Color::Gray, EntityColor::palette('missing-entity'));
    }

    public function test_translation_form_schema_returns_the_shared_translation_fields(): void
    {
        $schema = TranslationFormSchema::make();

        $this->assertCount(5, $schema);
        $this->assertInstanceOf(Select::class, $schema[0]);
        $this->assertSame('language_id', $schema[0]->getName());
        $this->assertInstanceOf(Select::class, $schema[1]);
        $this->assertSame('context_id', $schema[1]->getName());
        $this->assertInstanceOf(TextInput::class, $schema[2]);
        $this->assertSame('name', $schema[2]->getName());
        $this->assertInstanceOf(Textarea::class, $schema[3]);
        $this->assertSame('alternate_name', $schema[3]->getName());
        $this->assertInstanceOf(Textarea::class, $schema[4]);
        $this->assertSame('description', $schema[4]->getName());
        $this->assertSame('language_id', TranslationFormSchema::languageField()->getName());
        $this->assertSame('context_id', TranslationFormSchema::contextField()->getName());
        $this->assertSame('name', TranslationFormSchema::nameField()->getName());
        $this->assertSame('alternate_name', TranslationFormSchema::alternateNameField()->getName());
        $this->assertSame('description', TranslationFormSchema::descriptionField()->getName());
    }

    public function test_table_column_concerns_apply_the_shared_defaults(): void
    {
        $internalNameColumn = FilamentConventionSupportFixture::internalName();
        $backwardCompatibilityColumn = FilamentConventionSupportFixture::backwardCompatibility();
        $uuidColumn = FilamentConventionSupportFixture::uuid();
        $timestampsColumns = FilamentConventionSupportFixture::timestamps();

        $this->assertInstanceOf(TextColumn::class, $internalNameColumn);
        $this->assertSame('internal_name', $internalNameColumn->getName());
        $this->assertTrue($internalNameColumn->isSearchable());
        $this->assertTrue($internalNameColumn->isSortable());

        $this->assertInstanceOf(TextColumn::class, $backwardCompatibilityColumn);
        $this->assertSame('backward_compatibility', $backwardCompatibilityColumn->getName());
        $this->assertTrue($backwardCompatibilityColumn->isSearchable());
        $this->assertTrue($backwardCompatibilityColumn->isSortable());

        $this->assertInstanceOf(TextColumn::class, $uuidColumn);
        $this->assertSame('id', $uuidColumn->getName());
        $this->assertTrue($uuidColumn->isCopyable('test'));
        $this->assertTrue($uuidColumn->isToggledHiddenByDefault());

        $this->assertCount(2, $timestampsColumns);
        $this->assertSame('created_at', $timestampsColumns[0]->getName());
        $this->assertTrue($timestampsColumns[0]->isToggledHiddenByDefault());
        $this->assertSame('updated_at', $timestampsColumns[1]->getName());
        $this->assertTrue($timestampsColumns[1]->isToggledHiddenByDefault());
    }
}

class FilamentConventionSupportFixture
{
    use HasBackwardCompatibilityColumn;
    use HasInternalNameColumn;
    use HasTimestampsColumns;
    use HasUuidColumn;

    public static function backwardCompatibility(): TextColumn
    {
        return static::backwardCompatibilityColumn();
    }

    public static function internalName(): TextColumn
    {
        return static::internalNameColumn();
    }

    /**
     * @return array<int, TextColumn>
     */
    public static function timestamps(): array
    {
        return static::timestampsColumns();
    }

    public static function uuid(): TextColumn
    {
        return static::uuidColumn();
    }
}
