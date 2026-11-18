# Génère les icônes PNG de la PWA (même dessin que public/icon.svg)
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot '..\public'

function New-Icon([int]$size, [string]$name) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $s = $size / 512.0
  $g.Clear([System.Drawing.Color]::White)
  $red = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#be123c'))
  $dark = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#1e293b'))
  $g.FillEllipse($red, 136 * $s, 110 * $s, 240 * $s, 240 * $s)
  $pts = @(@(96,420),@(200,300),@(256,360),@(320,280),@(416,420)) | ForEach-Object { New-Object System.Drawing.PointF ($_[0]*$s), ($_[1]*$s) }
  $g.FillPolygon($dark, [System.Drawing.PointF[]]$pts)
  $snow = @(@(286,316),@(320,280),@(354,328)) | ForEach-Object { New-Object System.Drawing.PointF ($_[0]*$s), ($_[1]*$s) }
  $g.FillPolygon([System.Drawing.Brushes]::White, [System.Drawing.PointF[]]$snow)
  $bmp.Save((Join-Path $out $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

New-Icon 192 'icon-192.png'
New-Icon 512 'icon-512.png'
New-Icon 180 'apple-touch-icon.png'
