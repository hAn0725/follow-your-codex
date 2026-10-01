Option Explicit
Dim shell, files, folder, nodePath, command
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
folder = files.GetParentFolderName(WScript.ScriptFullName)
nodePath = "C:\Program Files\nodejs\node.exe"
If Not files.FileExists(nodePath) Then
  MsgBox "Node.js was not found. Please install Node.js and try again.", 48, "follow your codex"
  WScript.Quit 1
End If
shell.CurrentDirectory = folder
command = Chr(34) & nodePath & Chr(34) & " " & Chr(34) & folder & "\server.js" & Chr(34) & " --desktop"
shell.Run command, 0, False
