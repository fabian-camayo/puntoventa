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
  StrCpy $R2 0
  loop:
    StrCpy $R3 $R0 1 $R2
    StrCmp $R3 "" done
    StrCmp $R3 "$" is_dollar
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

  ${NSD_CreateLabel} 0 0 100% 24u "MySQL debe estar instalado. Indique los datos de conexion (tambien puede configurarlos al iniciar la app)."
  Pop $0

  ${NSD_CreateLabel} 0 28u 90u 12u "Host MySQL:"
  Pop $0
  ${NSD_CreateText} 100u 26u 200u 12u "localhost"
  Pop $PvHwndDbHost

  ${NSD_CreateLabel} 0 46u 90u 12u "Puerto MySQL:"
  Pop $0
  ${NSD_CreateText} 100u 44u 80u 12u "3306"
  Pop $PvHwndDbPort

  ${NSD_CreateLabel} 0 64u 90u 12u "Usuario:"
  Pop $0
  ${NSD_CreateText} 100u 62u 200u 12u "root"
  Pop $PvHwndDbUser

  ${NSD_CreateLabel} 0 82u 90u 12u "Contrasena:"
  Pop $0
  ${NSD_CreatePassword} 100u 80u 200u 12u ""
  Pop $PvHwndDbPassword

  ${NSD_CreateLabel} 0 100u 90u 12u "Base de datos:"
  Pop $0
  ${NSD_CreateText} 100u 98u 200u 12u "puntoventa"
  Pop $PvHwndDbName

  ${NSD_CreateLabel} 0 118u 90u 12u "Puerto API:"
  Pop $0
  ${NSD_CreateText} 100u 116u 80u 12u "3000"
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
  ; Copia para todos los usuarios que lancen la app (ruta del exe)
  FileOpen $0 "$INSTDIR\installer.env" w
  FileWrite $0 "# Generado por el instalador PuntoVenta$\r$\n"
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

  ; Acceso rapido para el usuario que instala
  SetShellVarContext current
  CreateDirectory "$APPDATA\PuntoVenta"
  CopyFiles /SILENT "$INSTDIR\installer.env" "$APPDATA\PuntoVenta\.env"
!macroend
