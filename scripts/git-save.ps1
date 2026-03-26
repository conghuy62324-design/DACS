param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$MessageParts
)

$ErrorActionPreference = "Stop"

$message = ($MessageParts -join " ").Trim()
if ([string]::IsNullOrWhiteSpace($message)) {
  $message = "update project"
}

git add .
$changes = git diff --cached --name-only

if (-not $changes) {
  Write-Host "Khong co thay doi nao de commit."
  exit 0
}

git commit -m $message
Write-Host "Da tao commit: $message"
