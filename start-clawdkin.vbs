' Starts Clawdkin without a console window (Windows). Double-click this file.
' Run "npm install" in this folder once before the first start.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
here = fso.GetParentFolderName(WScript.ScriptFullName)
exe = here & "\node_modules\electron\dist\electron.exe"
If Not fso.FolderExists(here & "\node_modules\electron") Then
  MsgBox "Clawdkin isn't installed yet. Open a terminal in this folder and run:" & vbCrLf & vbCrLf & "    npm install", vbInformation, "Clawdkin"
  WScript.Quit
End If
If Not fso.FileExists(exe) Then
  ' newer Electron versions download their binary on first use
  sh.Run "node """ & here & "\node_modules\electron\install.js""", 0, True
  If Not fso.FileExists(exe) Then
    MsgBox "Electron hasn't finished installing. Open a terminal in this folder and run:" & vbCrLf & vbCrLf & "    npm start" & vbCrLf & vbCrLf & "once (it needs an internet connection the first time).", vbExclamation, "Clawdkin"
    WScript.Quit
  End If
End If
sh.Run """" & exe & """ """ & here & """", 0, False
