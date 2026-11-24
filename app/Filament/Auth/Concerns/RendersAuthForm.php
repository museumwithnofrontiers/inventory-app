<?php

namespace App\Filament\Auth\Concerns;

use Filament\Actions\Action;
use Filament\Schemas\Components\Actions;
use Filament\Schemas\Components\Component;
use Filament\Schemas\Components\EmbeddedSchema;
use Filament\Schemas\Components\Form;
use Filament\Schemas\Schema;

/**
 * The page's form, its full-width actions underneath, submitted to one
 * Livewire method: the layout of Filament's own sign-in pages.
 */
trait RendersAuthForm
{
    public function content(Schema $schema): Schema
    {
        return $schema->components([
            $this->getFormContentComponent(),
        ]);
    }

    protected function getFormContentComponent(): Component
    {
        return Form::make([EmbeddedSchema::make('form')])
            ->id('form')
            ->livewireSubmitHandler($this->formSubmitHandler())
            ->footer([
                Actions::make($this->getFormActions())
                    ->fullWidth()
                    ->key('form-actions'),
            ]);
    }

    /**
     * The Livewire method the form submits to.
     */
    protected function formSubmitHandler(): string
    {
        return 'submit';
    }

    /**
     * @return array<Action>
     */
    abstract protected function getFormActions(): array;
}
