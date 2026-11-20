Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
agentPath = fso.GetParentFolderName(WScript.ScriptFullName) & "\tracker-agent.mjs"
shell.Run "node """ & agentPath & """", 0, False
