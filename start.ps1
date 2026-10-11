# ローカル表示用（Node / npx 不要）
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$Port = 8080
$Root = $PSScriptRoot

$Mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".pdf"  = "application/pdf"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
}

function Get-LocalUrl {
  param([string]$HostName)
  "http://${HostName}:${Port}/"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:${Port}/")
$listener.Prefixes.Add("http://localhost:${Port}/")

try {
  $listener.Start()
} catch {
  Write-Host "ポート $Port で起動できませんでした。別のアプリが使用中かもしれません。" -ForegroundColor Red
  Write-Host $_.Exception.Message
  exit 1
}

$url = Get-LocalUrl "localhost"
Write-Host ""
Write-Host "気血水チェック — ローカルサーバー起動" -ForegroundColor Green
Write-Host "  PC:     $url"
Write-Host "  停止:   このウィンドウで Ctrl+C"
Write-Host ""
Write-Host "※ index.html をダブルクリックだけでも使えます（グラフはインターネット接続が必要）"
Write-Host ""

try {
  Start-Process $url | Out-Null
} catch {
  # ブラウザを開けなくてもサーバーは動く
}

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $request = $context.Request
  $response = $context.Response

  try {
    $path = [Uri]::UnescapeDataString($request.Url.LocalPath)
    if ($path -eq "/" -or $path -eq "") {
      $path = "/index.html"
    }

    $relative = $path.TrimStart("/").Replace("/", [IO.Path]::DirectorySeparatorChar)
    $filePath = Join-Path $Root $relative
    $fullRoot = [IO.Path]::GetFullPath($Root)
    $fullFile = [IO.Path]::GetFullPath($filePath)

    if (-not $fullFile.StartsWith($fullRoot, [StringComparison]::OrdinalIgnoreCase)) {
      $response.StatusCode = 403
      $bytes = [Text.Encoding]::UTF8.GetBytes("403 Forbidden")
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
      $response.Close()
      continue
    }

    if (-not (Test-Path -LiteralPath $fullFile -PathType Leaf)) {
      $response.StatusCode = 404
      $bytes = [Text.Encoding]::UTF8.GetBytes("404 Not Found")
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
      $response.Close()
      continue
    }

    $ext = [IO.Path]::GetExtension($fullFile).ToLowerInvariant()
    if ($Mime.ContainsKey($ext)) {
      $response.ContentType = $Mime[$ext]
    } else {
      $response.ContentType = "application/octet-stream"
    }

    $content = [IO.File]::ReadAllBytes($fullFile)
    $response.ContentLength64 = $content.Length
    $response.OutputStream.Write($content, 0, $content.Length)
  } catch {
    $response.StatusCode = 500
    $msg = [Text.Encoding]::UTF8.GetBytes("500 Internal Server Error")
    $response.OutputStream.Write($msg, 0, $msg.Length)
  } finally {
    $response.Close()
  }
}
