; Páginas custom del instalador NSIS (electron-builder).
; Captura MySQL y escribe installer.env (+ AppData\.env cuando sea posible).

!include "nsDialogs.nsh"
!include "LogicLib.nsh"

Var PvDialog
Var PvDbHost
Var PvDbPort
Var PvDbUser
Var PvDbPassword
Var PvDbName
Var PvApiPort
Var PvHwndDbHost
Var PvHwndDbPort
Var PvHwndDbUser
Var PvHwndDbPassword
Var PvHwndDbName
Var PvHwndApiPort

; Escapa $ → $$ para FileWrite seguro en NSIS
Function PvEscapeDollars
  Exch $R0
  Push $R1
  Push $R2
  Push $R3
  StrCpy $R1 ""
  StrCpy $R2 "0"
  loop:
    StrCpy $R3 $R0 1 $R2
    StrLen $R9 $R3
    IntCmp $R9 0 done
    ; "$$" en literales NSIS = caracter $
    StrCmp $R3 "$$" is_dollar 0
      StrCpy $R1 "$R1$R3"
      Goto next
    is_dollar:
      StrCpy $R1 "$R1$$"
    next:
      IntOp $R2 $R2 + 1
      Goto loop
  done:
  StrCpy $R0 $R1
  Pop $R3
  Pop $R2
  Pop $R1
  Exch $R0
FunctionEnd

!macro customPageAfterChangeDir
  Page custom PvDbPageCreate PvDbPageLeave
!macroend

Function PvDbPageCreate
  nsDialogs::Create 1018
  Pop $PvDialog
  ${If} $PvDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 36u "Base de datos MySQL (debe estar en ejecucion). Si la base no existe, Granel la crea. Deje la contrasena vacia solo si root no tiene clave."
  Pop $0

  ${NSD_CreateLabel} 0 40u 90u 12u "Host MySQL:"
  Pop $0
  ${NSD_CreateText} 100u 38u 200u 12u "localhost"
  Pop $PvHwndDbHost

  ${NSD_CreateLabel} 0 58u 90u 12u "Puerto MySQL:"
  Pop $0
  ${NSD_CreateText} 100u 56u 80u 12u "3306"
  Pop $PvHwndDbPort

  ${NSD_CreateLabel} 0 76u 90u 12u "Usuario:"
  Pop $0
  ${NSD_CreateText} 100u 74u 200u 12u "root"
  Pop $PvHwndDbUser

  ${NSD_CreateLabel} 0 94u 90u 12u "Contrasena:"
  Pop $0
  ${NSD_CreatePassword} 100u 92u 200u 12u ""
  Pop $PvHwndDbPassword

  ${NSD_CreateLabel} 0 112u 90u 12u "Base de datos:"
  Pop $0
  ${NSD_CreateText} 100u 110u 200u 12u "puntoventa"
  Pop $PvHwndDbName

  ${NSD_CreateLabel} 0 130u 90u 12u "Puerto API:"
  Pop $0
  ${NSD_CreateText} 100u 128u 80u 12u "3000"
  Pop $PvHwndApiPort

  nsDialogs::Show
FunctionEnd

Function PvDbPageLeave
  ${NSD_GetText} $PvHwndDbHost $PvDbHost
  ${NSD_GetText} $PvHwndDbPort $PvDbPort
  ${NSD_GetText} $PvHwndDbUser $PvDbUser
  ${NSD_GetText} $PvHwndDbPassword $PvDbPassword
  ${NSD_GetText} $PvHwndDbName $PvDbName
  ${NSD_GetText} $PvHwndApiPort $PvApiPort

  ${If} $PvDbHost == ""
    MessageBox MB_OK|MB_ICONEXCLAMATION "El host de MySQL es obligatorio."
    Abort
  ${EndIf}
  ${If} $PvDbUser == ""
    MessageBox MB_OK|MB_ICONEXCLAMATION "El usuario de MySQL es obligatorio."
    Abort
  ${EndIf}
  ${If} $PvDbName == ""
    MessageBox MB_OK|MB_ICONEXCLAMATION "El nombre de la base de datos es obligatorio."
    Abort
  ${EndIf}
  ${If} $PvDbPort == ""
    StrCpy $PvDbPort "3306"
  ${EndIf}
  ${If} $PvApiPort == ""
    StrCpy $PvApiPort "3000"
  ${EndIf}
FunctionEnd

!macro PvWriteEnvLine FILE KEY VALUE
  Push "${VALUE}"
  Call PvEscapeDollars
  Pop $R9
  FileWrite ${FILE} "${KEY}=$R9$\r$\n"
!macroend

!macro customInstall
  FileOpen $0 "$INSTDIR\installer.env" w
  FileWrite $0 "# Generado por el instalador Granel$\r$\n"
  !insertmacro PvWriteEnvLine $0 "DB_HOST" "$PvDbHost"
  !insertmacro PvWriteEnvLine $0 "DB_PORT" "$PvDbPort"
  !insertmacro PvWriteEnvLine $0 "DB_USER" "$PvDbUser"
  !insertmacro PvWriteEnvLine $0 "DB_PASSWORD" "$PvDbPassword"
  !insertmacro PvWriteEnvLine $0 "DB_NAME" "$PvDbName"
  !insertmacro PvWriteEnvLine $0 "API_PORT" "$PvApiPort"
  FileWrite $0 "API_HOST=0.0.0.0$\r$\n"
  FileWrite $0 "APP_MODE=STANDALONE$\r$\n"
  FileWrite $0 "SERVER_HOST=localhost$\r$\n"
  !insertmacro PvWriteEnvLine $0 "SERVER_PORT" "$PvApiPort"
  FileClose $0

  SetShellVarContext current
  CreateDirectory "$APPDATA\PuntoVenta"
  CopyFiles /SILENT "$INSTDIR\installer.env" "$APPDATA\PuntoVenta\.env"
!macroend
