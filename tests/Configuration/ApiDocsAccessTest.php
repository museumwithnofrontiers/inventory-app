<?php

namespace Tests\Configuration;

use Tests\TestCase;

class ApiDocsAccessTest extends TestCase
{
    public function test_api_json_is_valid(): void
    {
        $response = $this->get(route('api.documentation'));

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/json');

        $responseData = $response->json();
        $this->assertArrayHasKey('openapi', $responseData);
        $this->assertMatchesRegularExpression('/^3\.1\.\d+$/', $responseData['openapi']);
        $this->assertArrayHasKey('info', $responseData);
        $this->assertArrayHasKey('title', $responseData['info']);
        $this->assertArrayHasKey('version', $responseData['info']);
        $this->assertArrayHasKey('paths', $responseData);
        $this->assertIsArray($responseData['paths']);
    }

    /**
     * Test API docs are accessible in the default test environment.
     *
     * Tests run under APP_ENV=testing. The middleware allows both 'local' and
     * 'testing' environments without requiring an explicit scramble.enabled flag.
     */
    public function test_api_docs_accessible_in_test_environment(): void
    {
        $response = $this->get(route('scramble.docs.ui'));
        $response->assertOk();

        $response = $this->get(route('scramble.docs.document'));
        $response->assertOk();
    }

    /**
     * Test API docs return the expected content-type headers.
     */
    public function test_api_docs_return_expected_content_type(): void
    {
        $response = $this->get(route('scramble.docs.ui'));
        $response->assertOk();
        $response->assertHeader('content-type', 'text/html; charset=utf-8');

        $response = $this->get(route('scramble.docs.document'));
        $response->assertOk();
        $response->assertHeader('content-type', 'application/json');
    }

    /**
     * Test API docs respect the scramble.enabled config flag in production.
     *
     * In production (non-local/testing), access is controlled exclusively by
     * the scramble.enabled config. This is the canonical smoke test for the
     * access-control middleware (CustomRestrictedDocsAccess).
     */
    public function test_api_docs_respect_boolean_like_values(): void
    {
        config(['app.env' => 'production']);

        // Enabled
        config(['scramble.enabled' => true]);
        $response = $this->get(route('scramble.docs.ui'));
        $response->assertOk();

        // Disabled
        config(['scramble.enabled' => false]);
        $response = $this->get(route('scramble.docs.ui'));
        $response->assertStatus(403);
    }
}
