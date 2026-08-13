Set WshShell = CreateObject("WScript.Shell")
' Run the launcher script silently without showing a black cmd window
WshShell.Run "node run-desktop.js", 0, false
