$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$iconPath = Join-Path $PSScriptRoot 'codex-token-meter.ico'
$images = @()
foreach ($size in @(16,32,48,256)) {
    $bitmap = New-Object System.Drawing.Bitmap($size,$size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.ScaleTransform($size / 256.0,$size / 256.0)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $background = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#163C30'))
    $mint = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#99E2B4'))
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $graphics.FillEllipse($background,4,4,248,248)
    $pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#99E2B4'),8)
    $graphics.DrawArc($pen,20,20,216,216,140,260)
    $graphics.FillRectangle($white,83,133,22,42)
    $graphics.FillRectangle($mint,117,104,22,71)
    $graphics.FillRectangle($white,151,70,22,105)
    $codePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White,7)
    $graphics.DrawLines($codePen,[System.Drawing.Point[]]@([System.Drawing.Point]::new(64,100),[System.Drawing.Point]::new(46,123),[System.Drawing.Point]::new(64,146)))
    $graphics.DrawLines($codePen,[System.Drawing.Point[]]@([System.Drawing.Point]::new(192,100),[System.Drawing.Point]::new(210,123),[System.Drawing.Point]::new(192,146)))
    $font = New-Object System.Drawing.Font('Segoe UI',22,[System.Drawing.FontStyle]::Bold)
    $graphics.DrawString('TOK',$font,$mint,86,181)
    $stream = New-Object System.IO.MemoryStream
    $bitmap.Save($stream,[System.Drawing.Imaging.ImageFormat]::Png)
    $images += ,($stream.ToArray())
    $stream.Dispose(); $font.Dispose(); $codePen.Dispose(); $pen.Dispose()
    $white.Dispose(); $mint.Dispose(); $background.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
$outputStream = [System.IO.File]::Create($iconPath)
$writer = New-Object System.IO.BinaryWriter($outputStream)
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]4)
$offset = 6 + 16 * 4
for ($i=0; $i -lt 4; $i++) {
    $dimension = @(16,32,48,0)[$i]
    $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
    $writer.Write([byte]0); $writer.Write([byte]0)
    $writer.Write([uint16]1); $writer.Write([uint16]32)
    $writer.Write([uint32]$images[$i].Length); $writer.Write([uint32]$offset)
    $offset += $images[$i].Length
}
foreach ($bytes in $images) { $writer.Write([byte[]]$bytes) }
$writer.Dispose(); $outputStream.Dispose()
$desktopPath = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopPath 'Follow Your Codex - Token Meter.lnk'
if (Test-Path -LiteralPath $shortcutPath) { throw "Shortcut already exists: $shortcutPath" }
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
$shortcut.Arguments = '"' + (Join-Path $PSScriptRoot 'launch-hidden.vbs') + '"'
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Description = 'Codex token usage and estimated cost. Closes after the last dashboard tab closes.'
$shortcut.WindowStyle = 7
$shortcut.Save()
Write-Output $shortcutPath
