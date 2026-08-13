param(
    [string]$title,
    [string]$body,
    [string]$postId,
    [string]$platform
)

$dmUrl = "http://localhost:3001/api/notify-action?id=$postId&amp;type=dm"
$commentUrl = "http://localhost:3001/api/notify-action?id=$postId&amp;type=comment"

$xmlActions = ""
if ($platform -eq "twitter") {
    $xmlActions = @"
  <actions>
    <action content="Send DM" arguments="$dmUrl" activationType="protocol" />
    <action content="Reply Comment" arguments="$commentUrl" activationType="protocol" />
  </actions>
"@
} else {
    $xmlActions = @"
  <actions>
    <action content="Send DM" arguments="$dmUrl" activationType="protocol" />
  </actions>
"@
}

$xml = @"
<toast>
  <visual>
    <binding template="ToastGeneric">
      <text>$title</text>
      <text>$body</text>
    </binding>
  </visual>
  $xmlActions
</toast>
"@

try {
    $xmlType = [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]
    $xmlDoc = [Activator]::CreateInstance($xmlType)
    $xmlDoc.LoadXml($xml)

    $toastType = [Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime]
    $toast = [Activator]::CreateInstance($toastType, $xmlDoc)

    $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Reach Companion")
    $notifier.Show($toast)
} catch {
    # Fallback to standard NotifyIcon
    [void] [System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms")
    $objNotification = New-Object System.Windows.Forms.NotifyIcon
    $objNotification.Icon = [System.Drawing.SystemIcons]::Information
    $objNotification.BalloonTipIcon = "Info"
    $objNotification.BalloonTipText = $body
    $objNotification.BalloonTipTitle = $title
    $objNotification.Visible = $True
    $objNotification.ShowBalloonTip(5000)
    Start-Sleep -Seconds 1
}
