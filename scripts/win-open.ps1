<#
  يفتح واجهة المتجر أو لوحة الإدارة.

  قاعدة واحدة تحدّد الوجهة: إن كان في `site-url.txt` على سطح المكتب رابط
  منشور فذاك هو المتجر الحقيقي ونفتحه. وإلا فالمتجر يعيش على هذا الجهاز
  وحده، فنتأكد أن الخادم المحلي يعمل قبل فتح المتصفح — النقر على أيقونة
  يجب ألّا ينتهي بصفحة خطأ.

  ── لماذا PowerShell لا batch ─────────────────────────────────────
  كُتب أولًا كـ batch ففشل في أمرين: هروب `|` داخل `for /f` كان يصل إلى
  PowerShell حرفًا لا فاصلًا، و`timeout /t` يخرج فورًا حين يكون الإدخال
  موجّهًا. كلاهما يظهر عند التشغيل الآلي لا عند النقر، أي أنه يمرّ من
  الاختبار السريع ويفشل عند التاجر.
#>

param(
  [string]$Path = '/',
  [string]$Title = 'Monebra'
)

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = $Title

# مجلد سطح المكتب: scripts ← monebra-store ← المجلد الذي فيه الأيقونات
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$siteFile = Join-Path $root 'site-url.txt'
$serverScript = Join-Path $PSScriptRoot 'win-server.bat'
$local = 'http://localhost:3000'

# أي ردّ HTTP يعني أن الخادم يعمل — بما فيه 307 و404. الاتصال المرفوض
# وحده يعني أنه متوقّف. فحص المنفذ لا يكفي: المنفذ يُفتح قبل أن يصير
# التطبيق قادرًا على الردّ، فيُفتح المتصفح على صفحة خطأ.
function Test-Store {
  try {
    $null = Invoke-WebRequest -Uri "$local/" -UseBasicParsing -TimeoutSec 5
    return $true
  } catch {
    return $null -ne $_.Exception.Response
  }
}

$site = $null

if (Test-Path -LiteralPath $siteFile) {
  foreach ($line in Get-Content -LiteralPath $siteFile) {
    $trimmed = $line.Trim()
    if ($trimmed.StartsWith('https://')) {
      $site = $trimmed.TrimEnd('/')
      break
    }
  }
}

if ($site) {
  Write-Host "  Opening $site$Path"
  Start-Process "$site$Path"
  exit 0
}

if (-not (Test-Store)) {
  Write-Host ''
  Write-Host '  Starting the store server, please wait...'
  Start-Process -FilePath $serverScript -WindowStyle Minimized

  # أول تشغيل يبني المتجر وذلك يستغرق دقائق — من هنا الانتظار الطويل
  for ($i = 0; $i -lt 120; $i++) {
    Start-Sleep -Seconds 2
    if (Test-Store) { break }
  }
}

if (-not (Test-Store)) {
  Write-Host ''
  Write-Host '  The server did not answer. Check the "Monebra Perfume"'
  Write-Host '  server window for the error, then try again.'
  Write-Host ''
  Read-Host '  Press Enter to close'
  exit 1
}

Start-Process "$local$Path"
