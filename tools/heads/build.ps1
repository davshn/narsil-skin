# Makes hooks/heads.ts: Narsil's head, light and dark, as pixel art drawn with plain vectors, for the
# thinking indicator and the question card. The desktop app scrubs a PNG embedded in an SVG, so the picture
# is redrawn as plain vectors. The head is the top square of her transparent art in the narsil-pet repository.
#   powershell -ExecutionPolicy Bypass -File tools/heads/build.ps1 -Art <path-to-narsil-pet>/assets
# -Size is the thinking indicator's grid, -AskSize the question card's: finer, as the card draws her larger.
param([Parameter(Mandatory = $true)][string]$Art, [int]$Size = 32, [int]$AskSize = 80)

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Add-Type -AssemblyName System.Drawing

function Get-Head([string]$file, [int]$n) {
  $src = [System.Drawing.Bitmap]::FromFile($file)
  # her head and crest: a square from the top, as wide as the drawing
  $crop = New-Object System.Drawing.Rectangle 0, 0, $src.Width, $src.Width
  $bmp = New-Object System.Drawing.Bitmap $n, $n, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $n, $n), $crop, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose(); $src.Dispose()
  return $bmp
}

# a pixel's color to 4 bits a channel, so neighbours merge into one run
function Get-Key([System.Drawing.Color]$c) {
  '#{0:x}{1:x}{2:x}@{3}' -f ($c.R -shr 4), ($c.G -shr 4), ($c.B -shr 4), [math]::Round($c.A / 255, 1)
}

# each row as runs of one color, calling $emit with x, y, width and color key; faint pixels are left out
function Get-Runs([System.Drawing.Bitmap]$bmp, [int]$n, [scriptblock]$emit) {
  for ($y = 0; $y -lt $n; $y++) {
    $x = 0
    while ($x -lt $n) {
      $c = $bmp.GetPixel($x, $y)
      if ($c.A -lt 24) { $x++; continue }
      $key = Get-Key $c
      $w = 1
      while ($x + $w -lt $n) {
        $d = $bmp.GetPixel($x + $w, $y)
        if ($d.A -lt 24 -or (Get-Key $d) -ne $key) { break }
        $w++
      }
      & $emit $x $y $w $key
      $x += $w
    }
  }
}

function Get-Fill([string]$key) {
  $fill, $alpha = $key.Split('@')
  $op = if ([double]$alpha -lt 1) { " fill-opacity=`"$alpha`"" } else { '' }
  return "fill=`"$fill`"$op"
}

# one <rect> a run
function Get-Rects([System.Drawing.Bitmap]$bmp, [int]$n) {
  $sb = New-Object System.Text.StringBuilder
  Get-Runs $bmp $n { param($x, $y, $w, $key)
    [void]$sb.Append("<rect x=`"$x`" y=`"$y`" width=`"$w`" height=`"1`" $(Get-Fill $key)/>")
  }
  return $sb.ToString()
}

# one <path> a color, each run a short subpath: a finer grid fits the app's limit on an SVG's length
function Get-Paths([System.Drawing.Bitmap]$bmp, [int]$n) {
  $byColor = [ordered]@{}
  Get-Runs $bmp $n { param($x, $y, $w, $key)
    if (-not $byColor.Contains($key)) { $byColor[$key] = New-Object System.Text.StringBuilder }
    [void]$byColor[$key].Append("M$x ${y}h${w}v1h-${w}")
  }
  $sb = New-Object System.Text.StringBuilder
  foreach ($key in $byColor.Keys) { [void]$sb.Append("<path $(Get-Fill $key) d=`"$($byColor[$key])`"/>") }
  return $sb.ToString()
}

# one pose's head, light and dark: 'hola' is her greeting, 'necesita' her surprised face when she needs you
function Get-Pose([string]$pose, [int]$n, [string]$draw) {
  $pics = @{}
  foreach ($k in @('claro', 'oscuro')) {
    $bmp = Get-Head (Join-Path $Art "$pose-$k.png") $n
    $pics[$k] = & $draw $bmp $n
    $bmp.Dispose()
  }
  return $pics
}

$heads = Get-Pose 'hola' $Size 'Get-Rects'
$asking = Get-Pose 'necesita' $AskSize 'Get-Paths'

$ts = @"
// Narsil's head as pixel art: made by tools/heads/build.ps1, do not edit
// her greeting on a $Size x $Size grid, for the thinking indicator
export const HEAD_SIZE = $Size
export const HEADS = {
  light: '$($heads['claro'])',
  dark: '$($heads['oscuro'])',
}
// her surprised face on a $AskSize x $AskSize grid, for the card where Claude asks you a question
export const ASK_SIZE = $AskSize
export const ASKING = {
  light: '$($asking['claro'])',
  dark: '$($asking['oscuro'])',
}
"@
$out = Join-Path $root 'hooks\heads.ts'
[System.IO.File]::WriteAllText($out, $ts + "`n", (New-Object System.Text.UTF8Encoding $false))
Write-Output ("Wrote {0}: {1}, {2}, {3} and {4} characters" -f $out, $heads['claro'].Length, $heads['oscuro'].Length, $asking['claro'].Length, $asking['oscuro'].Length)
