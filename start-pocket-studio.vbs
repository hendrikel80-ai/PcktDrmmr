' Startet start-pocket-studio.ps1 komplett unsichtbar (kein PowerShell-
' Fenster, kein CMD-Fenster) - das ist das eigentliche Ziel dieser Datei.
' Die Desktop-Verknuepfung zeigt hierher statt auf die .bat/.ps1 direkt.
Set objShell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
objShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & scriptDir & "\start-pocket-studio.ps1""", 0, False
