<#
    .SYNOPSIS
        Copy images from local storage to OVH VPS over SSH.
    .DESCRIPTION
        The images are pristine originals, so the default destination is the
        app's private originals directory (localstorage.available.images: the
        image-originals disk, directory "images"). The public pictures
        directory is only a cache of burned renditions that /pub fills on
        demand; never copy originals there.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$User,
    
    [Parameter(Mandatory = $true)]
    [ValidateScript({ 
        (Test-Path $_ -PathType Leaf) -or (Test-Path (Join-Path ~/.ssh $_))
    })]
    [string]$SshKey,

    [Parameter(Mandatory = $true)]
    [ValidateScript({ 
        Test-NetConnection $_ -Port 22 -InformationLevel Quiet
    })]
    [string]$RemoteHost,

    [Parameter(Mandatory = $true)]
    [ValidateScript({ 
        Test-Path $_ -PathType Container
    })]
    [string]$LocalDir,

    [Parameter(Mandatory = $false)]
    [string]$RemoteDir = 'private/image-originals/images/',

    [Parameter(Mandatory = $false)]
    [string]$RemoteAppRoot = '/opt/inventory/current',

    [Parameter(Mandatory = $false)]
    [string]$RemoteAppStorage = '/opt/inventory/shared/storage/app/',

    [switch]
    $UseExistingArchive,

    [switch]
    $Force
)
$ErrorActionPreference = "Stop"
$Server = "$User@$RemoteHost"
$Archive = "$env:TEMP\inventory-images.zip"
$RemoteAppStorage = $RemoteAppStorage.TrimEnd('/')
$RemoteDir = $RemoteDir.Trim('/')

if (-not (Test-Path $SshKey -PathType Leaf)) {
    $SshKey = Join-Path ~/.ssh $SshKey
}

if ($UseExistingArchive.IsPresent -and $UseExistingArchive) {
    if (-not (Test-Path $Archive)) {
        throw "Archive $Archive does not exist."
    }
} elseif (Test-Path $Archive) { 
    if (-not ($Force.IsPresent -and $Force)) {
        throw "Archive $Archive already exists. Use -Force to overwrite."
    }
    Remove-Item $Archive -Force 
}

$ProgressParams = @{
    Activity = "Copying images to $Server"
}

Write-Progress @ProgressParams -Status "Create temp directory on server..." -PercentComplete 0
ssh -i $SshKey $Server (@"
set -e
mkdir -p $RemoteAppStorage/tmp
"@ -replace "\r\n", "`n")
if ($LASTEXITCODE -ne 0) {
    throw "Failed to create temp directory on server"
}

Write-Progress @ProgressParams -Status "Compressing images..." -PercentComplete 1
if (-not ($UseExistingArchive.IsPresent -and $UseExistingArchive)) {
    Compress-Archive -Path $LocalDir\* -DestinationPath $Archive -Force -CompressionLevel NoCompression
}
$sizeMB = [math]::Round((Get-Item $Archive).Length / 1MB, 1)

Write-Progress @ProgressParams -Status "Uploading $sizeMB MB..." -PercentComplete 33
scp -i $SshKey -o StrictHostKeyChecking=accept-new $Archive "${Server}:/${RemoteAppStorage}/tmp/inventory-images.zip"
if ($LASTEXITCODE -ne 0) { 
    throw "scp failed"
}

Write-Progress @ProgressParams -Status "Extracting on server..." -PercentComplete 66
ssh -i $SshKey $Server (@"
set -e
mkdir -p $RemoteAppStorage/$RemoteDir
unzip -o /${RemoteAppStorage}/tmp/inventory-images.zip -d $RemoteAppStorage/$RemoteDir
rm ${RemoteAppStorage}/tmp/inventory-images.zip
find $RemoteAppStorage/$RemoteDir -type f | wc -l | xargs -I{} echo "Total files on server: {}"
"@ -replace "\r\n", "`n")
if ($LASTEXITCODE -ne 0) {
    throw "Extraction failed"
}

Write-Progress @ProgressParams -Status "php artisan storage:link..." -PercentComplete 90
ssh -i $SshKey $Server "cd $RemoteAppRoot && php artisan storage:link 2>&1 >/dev/null"

Write-Progress @ProgressParams -Status "Cleaning up..." -PercentComplete 99
Remove-Item $Archive -Force

Write-Progress @ProgressParams -Status "Done." -PercentComplete 100 -Completed
