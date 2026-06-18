/**
 * Contador global de modales abiertos.
 * Lo usa useDialogBackButton (suma/resta) y BackGuard (consulta) para
 * coordinar el botón "atrás": si hay un modal abierto, el back lo cierra;
 * si no, BackGuard decide si mantener al usuario en la app.
 */
let openCount = 0

export const modalStack = {
  open() {
    openCount += 1
  },
  close() {
    openCount = Math.max(0, openCount - 1)
  },
  isOpen() {
    return openCount > 0
  },
}
