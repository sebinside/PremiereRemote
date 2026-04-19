#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.


; Interesting code starts here, lol
F10::
Run curl ""http://localhost:8081/alert?content=helloworld"",,hide
return

F11::
Run curl ""http://localhost:8081/projectNameAlert"",,hide
return