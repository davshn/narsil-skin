# Makes hooks/heads.ts: Narsil's head, light and dark, as 32x32 pixel art drawn with <rect>s, for the
# thinking indicator. The desktop app scrubs a PNG embedded in an SVG, so the picture is redrawn as plain
# vectors. The head is the top square of her transparent art in the narsil-pet repository.
#   powershell -ExecutionPolicy Bypass -File tools/heads/build.ps1 -Art <path-to-narsil-pet>/assets
param([Parameter(Mandatory = $true)][string]$Art, [int]$Size = 32)

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Add-Type -AssemblyName System.Drawing

function Get-Head([string]$file) {
  $src = [System.Drawing.Bitmap]::FromFile($file)
  # her head and crest: a square from the top, as wide as the drawing
  $crop = New-Object System.Drawing.Rectangle 0, 0, $src.Width, $src.Width
  $bmp = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $Size, $Size), $crop, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose(); $src.Dispose()
  return $bmp
}

# a pixel's color to 4 bits a channel, so neighbours merge into one run
function Get-Key([System.Drawing.Color]$c) {
  '#{0:x}{1:x}{2:x}@{3}' -f ($c.R -shr 4), ($c.G -shr 4), ($c.B -shr 4), [math]::Round($c.A / 255, 1)
}

# each row as runs of one color, one <rect> a run; faint pixels are left out
function Get-Rects([System.Drawing.Bitmap]$bmp) {
  $sb = New-Object System.Text.StringBuilder
  for ($y = 0; $y -lt $Size; $y++) {
    $x = 0
    while ($x -lt $Size) {
      $c = $bmp.GetPixel($x, $y)
      if ($c.A -lt 24) { $x++; continue }
      $key = Get-Key $c
      $w = 1
      while ($x + $w -lt $Size) {
        $d = $bmp.GetPixel($x + $w, $y)
        if ($d.A -lt 24 -or (Get-Key $d) -ne $key) { break }
        $w++
      }
      $fill, $alpha = $key.Split('@')
      $op = if ([double]$alpha -lt 1) { " fill-opacity=`"$alpha`"" } else { '' }
      [void]$sb.Append("<rect x=`"$x`" y=`"$y`" width=`"$w`" height=`"1`" fill=`"$fill`"$op/>")
      $x += $w
    }
  }
  return $sb.ToString()
}

$heads = @{}
foreach ($k in @('claro', 'oscuro')) {
  $bmp = Get-Head (Join-Path $Art "hola-$k.png")
  $heads[$k] = Get-Rects $bmp
  $bmp.Dispose()
}

$ts = @"
// Narsil's head as $Size x $Size pixel art, for the thinking indicator: made by tools/heads/build.ps1, do not edit
export const HEAD_SIZE = $Size
export const HEADS = {
  light: '$($heads['claro'])',
  dark: '$($heads['oscuro'])',
}
"@
$out = Join-Path $root 'hooks\heads.ts'
[System.IO.File]::WriteAllText($out, $ts + "`n", (New-Object System.Text.UTF8Encoding $false))
Write-Output ("Wrote {0}: {1} and {2} characters" -f $out, $heads['claro'].Length, $heads['oscuro'].Length)
