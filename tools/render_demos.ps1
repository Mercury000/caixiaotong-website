param(
    [Parameter(Mandatory = $true)][string]$AndroidRepo,
    [string]$Frames,
    [string]$BuildDirectory
)

$ErrorActionPreference = 'Stop'
$appSource = (Resolve-Path -LiteralPath $AndroidRepo).Path
if (!$Frames) { $Frames = Join-Path $appSource 'tools\website-motion-frames' }
if (!$BuildDirectory) {
    $BuildDirectory = Join-Path ([IO.Path]::GetTempPath()) ('cxt-website-motion-' + [Guid]::NewGuid().ToString('N'))
}
if (Test-Path -LiteralPath $BuildDirectory) { throw 'Choose a new build directory for the isolated source snapshot.' }
$buildRoot = [IO.Path]::GetFullPath($BuildDirectory)
$frameRoot = [IO.Path]::GetFullPath($Frames)
$archive = $buildRoot + '.zip'

# Use committed sources; do not compile or alter local, unrelated app changes.
& git -C $appSource archive HEAD --format=zip "--output=$archive"
if ($LASTEXITCODE -ne 0) { throw 'Could not archive the Android sources.' }
Expand-Archive -LiteralPath $archive -DestinationPath $buildRoot
Remove-Item -LiteralPath $archive
Copy-Item -LiteralPath (Join-Path $appSource 'local.properties') -Destination $buildRoot
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'WebsiteMotionTest.kt') -Destination (Join-Path $buildRoot 'app\src\test\java\com\mercury\yktwx\WebsiteMotionTest.kt')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'WebsiteThemeTest.kt') -Destination (Join-Path $buildRoot 'app\src\test\java\com\mercury\yktwx\WebsiteThemeTest.kt')

# These presentation fixtures affect only the isolated preview, never production UI.
$fixture = Join-Path $buildRoot 'app\src\uiPreview\kotlin\com\mercury\yktwx\preview\PreviewData.kt'
$previewData = Get-Content -LiteralPath $fixture -Raw
if (!$previewData.Contains('fun hallState(multiple: Boolean = false)')) { throw 'Check the current hall preview fixture before rendering.' }
[IO.File]::WriteAllText($fixture, $previewData.Replace('fun hallState(multiple: Boolean = false)', 'fun hallState(multiple: Boolean = true)'), [Text.UTF8Encoding]::new($false))
$notes = @'
package com.mercury.yktwx.preview
import androidx.compose.runtime.Composable
internal object PreviewNotes {
    @Composable fun Payment(hasProblem: Boolean) {}
    @Composable fun Recharge() {}
    @Composable fun Bill() {}
    @Composable fun CardPassword() {}
    @Composable fun Captcha() {}
}
'@
[IO.File]::WriteAllText((Join-Path $buildRoot 'app\src\uiPreview\kotlin\com\mercury\yktwx\preview\PreviewNotes.kt'), $notes, [Text.UTF8Encoding]::new($false))

$previousFrames = $env:WEBSITE_MOTION_FRAMES
try {
    $env:WEBSITE_MOTION_FRAMES = $frameRoot
    & (Join-Path $buildRoot 'gradlew.bat') -p $buildRoot :app:testDebugUnitTest --tests 'com.mercury.yktwx.WebsiteMotionTest.paymentScenes' --tests 'com.mercury.yktwx.WebsiteMotionTest.paymentRecharge' --tests 'com.mercury.yktwx.WebsiteMotionTest.hallScenes' --tests 'com.mercury.yktwx.WebsiteMotionTest.hallRooms' --tests 'com.mercury.yktwx.WebsiteMotionTest.billScenes' --tests 'com.mercury.yktwx.WebsiteMotionTest.mineScenes' --tests 'com.mercury.yktwx.WebsiteMotionTest.mineTheme' --tests 'com.mercury.yktwx.WebsiteThemeTest.settingsControls' --tests 'com.mercury.yktwx.WebsiteThemeTest.lightEffects' --tests 'com.mercury.yktwx.WebsiteThemeTest.darkEffects' --tests 'com.mercury.yktwx.WebsiteThemeTest.lightBack' --tests 'com.mercury.yktwx.WebsiteThemeTest.darkBack' --no-configuration-cache
    if ($LASTEXITCODE -ne 0) { throw "Native capture failed. Inspect the reports in $buildRoot." }
} finally {
    $env:WEBSITE_MOTION_FRAMES = $previousFrames
}
Write-Output "Native PNG frames: $frameRoot"
