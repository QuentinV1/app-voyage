# Génère les icônes PNG de la PWA (même dessin que public/icon.svg)
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot '..\public'

function New-Icon([int]$size, [string]$name) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $s = $size / 512.0

  $brand = [System.Drawing.ColorTranslator]::FromHtml('#be123c')
  $softRose = [System.Drawing.ColorTranslator]::FromHtml('#fecdd3')
  $g.Clear($brand)

  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), (22 * $s)
  $g.DrawEllipse($pen, 102 * $s, 102 * $s, 308 * $s, 308 * $s)

  $ne = @(@(356,156),@(236,236),@(276,276)) | ForEach-Object { New-Object System.Drawing.PointF ($_[0]*$s), ($_[1]*$s) }
  $g.FillPolygon([System.Drawing.Brushes]::White, [System.Drawing.PointF[]]$ne)

  $roseBrush = New-Object System.Drawing.SolidBrush $softRose
  $sw = @(@(156,356),@(236,236),@(276,276)) | ForEach-Object { New-Object System.Drawing.PointF ($_[0]*$s), ($_[1]*$s) }
  $g.FillPolygon($roseBrush, [System.Drawing.PointF[]]$sw)

  $brandBrush = New-Object System.Drawing.SolidBrush $brand
  $g.FillEllipse($brandBrush, 238 * $s, 238 * $s, 36 * $s, 36 * $s)

  $bmp.Save((Join-Path $out $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $pen.Dispose(); $roseBrush.Dispose(); $brandBrush.Dispose()
  $g.Dispose(); $bmp.Dispose()
}

New-Icon 192 'icon-192.png'
New-Icon 512 'icon-512.png'
New-Icon 180 'apple-touch-icon.png'
