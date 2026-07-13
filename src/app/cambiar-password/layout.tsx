// page.tsx es 'use client' — mismo bug crítico que /login (ver
// src/app/login/layout.tsx para la explicación completa): la CSP con nonce
// requiere que la página se regenere en cada request para que el nonce del
// <script> coincida con el del header. Sin esto, el formulario de cambio de
// contraseña obligatorio en primer acceso queda inutilizable — un usuario
// nuevo no podría entrar nunca al sistema.
export const dynamic = 'force-dynamic'

export default function CambiarPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
