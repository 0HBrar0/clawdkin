# Rebuilds the README media in docs/: hero.gif, tricks.gif and forms.png.
# Needs ffmpeg on PATH. Run from the repo root:  pwsh dev/make-media.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$tmp = Join-Path ([IO.Path]::GetTempPath()) 'clawdkin-media'
$electron = Join-Path $root 'node_modules\electron\dist\electron.exe'
$docs = Join-Path $root 'docs'
New-Item -ItemType Directory -Force $docs | Out-Null
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue

# Claude's dark background, with a taskbar-like strip for the feet to stand on
$bg = '#262624'; $bar = '#1A1A19'
function Make-Gif($scene, $out) {
  & $electron (Join-Path $root 'dev\record.js') $scene (Join-Path $tmp $scene) | Out-Host
  $f = Join-Path $tmp "$scene\f%04d.png"
  $graph = "color=c=${bg}:s=380x380:r=25[bg];color=c=${bar}:s=380x26:r=25[bar];[bg][bar]overlay=0:354[base];" +
           "[base][0:v]overlay=40:16:shortest=1,split[a][b];[a]palettegen=max_colors=96:reserve_transparent=0[p];[b][p]paletteuse=dither=bayer:bayer_scale=4"
  ffmpeg -y -loglevel error -framerate 25 -i $f -filter_complex $graph -loop 0 $out
  Write-Host "$out  $([math]::Round((Get-Item $out).Length / 1KB)) KB"
}
Make-Gif 'hero' (Join-Path $docs 'hero.gif')
Make-Gif 'tricks' (Join-Path $docs 'tricks.gif')

# forms.png: the nine forms in a row
& $electron (Join-Path $root 'dev\record.js') forms (Join-Path $tmp 'forms') | Out-Host
$names = 'spark', 'glyph', 'doodle', 'clawd', 'prompt', 'origami', 'blocks', 'glass', 'moon'
$in = $names | ForEach-Object { '-i'; (Join-Path $tmp "forms\$_.png") }
$crop = (0..8 | ForEach-Object { "[$_]crop=230:230:35:110[c$_]" }) -join ';'
$stack = (0..8 | ForEach-Object { "[c$_]" }) -join ''
ffmpeg -y -loglevel error @in -filter_complex "$crop;${stack}hstack=inputs=9[s];color=c=${bg}:s=2070x262[b];[b][s]overlay=0:12:shortest=1" -frames:v 1 (Join-Path $docs 'forms.png')
Write-Host (Join-Path $docs 'forms.png')
Remove-Item $tmp -Recurse -Force
