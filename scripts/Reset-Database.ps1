& {
	function Invoke-Artisan {
		param(
			[Parameter(Mandatory = $true)]
			[string[]]$Arguments
		)

		docker compose run --rm app php artisan @Arguments
		if ($LASTEXITCODE -ne 0) {
			throw "Artisan command failed: php artisan $($Arguments -join ' ')"
		}
	}

	Write-Warning "This will WIPE THE ENTIRE DATABASE!"
	if ( 'I know what I do!' -eq (Read-Host -Prompt 'Type "I know what I do!" to continue...')) {
		$Directory = Split-Path -Parent $PSScriptRoot
		$SnapshotPath = 'auth-snapshots/reset-database-latest.json.enc'

		if ((Resolve-Path $Directory -ErrorAction Continue)) {
			Set-Location $Directory
			Invoke-Artisan @('auth:snapshot', $SnapshotPath, '--force')
			Invoke-Artisan @('db:wipe', '--force')
			Invoke-Artisan @('migrate', '--force')
			Invoke-Artisan @('db:seed', '--class=MinimalDatabaseSeeder', '--force')
			Invoke-Artisan @('permissions:sync')
			Invoke-Artisan @('auth:restore', $SnapshotPath, '--force')
		}
	} else {
		Write-Information 'Cancelled'
	}
}