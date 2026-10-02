<?php

namespace Tests\Web;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HealthTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_application_web_route_is_accessible(): void
    {
        $response = $this->get(route('web.welcome'));
        $response->assertOk();
        $response->assertHeader('Content-Type', 'text/html; charset=utf-8');
        $response->assertViewIs('home');
    }
}
