<#
  يشغّل المتجر على هذا الجهاز، على المنفذ 3000.

  ── لماذا PowerShell لا batch ─────────────────────────────────────
  كان هذا الملف batch، وفيه `for /f` يستدعي PowerShell ليعرف عنوان الجهاز
  في الشبكة. هروب `^|` و`^"` داخل تلك الصيغة لا يُحلَّل، فكان cmd يخرج على
  «was unexpected at this time» قبل أن يشغّل الخادم أصلًا — أي أن الأيقونة
  لم تكن تفتح المتجر. النافذة تُغلق بسرعة فلا يُقرأ الخطأ.

  الرسائل بالإنجليزية عمدًا: نافذة الأوامر تعرض العربية معكوسة ومقطّعة.
#>

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Monebra Perfume - Store Server'

Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Test-Path -LiteralPath 'package.json')) {
  Write-Host ''
  Write-Host '  ERROR: project folder not found.'
  Write-Host '  This file must stay inside monebra-store\scripts.'
  Write-Host ''
  Read-Host '  Press Enter to close'
  exit 1
}

# "next start" يخدم بناءً جاهزًا ولا ينشئه. على نسخة جديدة من المجلد لا
# يوجد بناء، وبدون هذا يخرج الخادم برسالة لا يستطيع صاحب المتجر التصرف
# بناءً عليها.
if (-not (Test-Path -LiteralPath '.next\BUILD_ID')) {
  Write-Host ''
  Write-Host '  First run - building the store. This takes a few minutes.'
  Write-Host ''

  & npm run build

  if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host '  BUILD FAILED. Send the text above to get it fixed.'
    Write-Host ''
    Read-Host '  Press Enter to close'
    exit 1
  }
}

# Next يطبع "Network: 0.0.0.0" وهو عنوان لا يُفتح من الهاتف، فنعرض العنوان
# الحقيقي للجهاز في الشبكة المحلية بدله.
$lan = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object {
    $_.IPAddress -notlike '127.*' -and
    $_.IPAddress -notlike '169.254.*' -and
    $_.PrefixOrigin -ne 'WellKnown'
  } |
  Select-Object -First 1).IPAddress

Write-Host ''
Write-Host '  =================================================='
Write-Host '    MONEBRA PERFUME'
Write-Host '  =================================================='
Write-Host ''
Write-Host '    Store        http://localhost:3000'
Write-Host '    Admin        http://localhost:3000/admin'
Write-Host ''

if ($lan) {
  Write-Host "    On phone     http://${lan}:3000"
  Write-Host '                 (same Wi-Fi only)'
} else {
  Write-Host '    On phone     no network address found'
}

Write-Host ''
Write-Host '    Keep this window open. Closing it stops the store.'
Write-Host '  =================================================='
Write-Host ''

& npx next start -p 3000 -H 0.0.0.0

Write-Host ''
Write-Host '  Server stopped.'
Read-Host '  Press Enter to close'
