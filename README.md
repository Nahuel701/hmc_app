# Jueves Santo HMC: GitHub Pages + Supabase

Propuesta de migración de la app desde Google Sheets + Apps Script a GitHub Pages + Supabase. La integración se activa al configurar Supabase en `supabase-config.js`; sin configuración, la app sigue usando la integración actual con Sheets.

## Arquitectura propuesta

- **GitHub Pages:** sirve `index.html`, `app.js` y los estilos.
- **Supabase Auth:** valida las cuentas individuales de acceso.
- **Supabase PostgreSQL:** guarda miembros, movimientos financieros y asistencia.
- **Supabase Edge Functions:** valida la sesión y centraliza las operaciones usadas por el frontend.

La propuesta no incluye reconocimiento de comprobantes. Los secretos de servidor, como `SUPABASE_SERVICE_ROLE_KEY`, nunca se configuran en GitHub Pages ni se incluyen en el repositorio.

## Qué contiene el PR

- `supabase/migrations/202609260001_initial_schema.sql`: tablas, restricciones e índices iniciales.
- `supabase/functions/login`: valida usuario/contraseña mediante Supabase Auth y devuelve una sesión.
- `supabase/functions/api`: lectura del panel y escrituras de movimientos, asistencia y cuotas.
- `supabase-client.js`: mantiene/refresca sesión en el navegador y llama a las Edge Functions.
- `supabase-config.js`: configuración pública del proyecto Supabase.
- `app.js`: selecciona Supabase cuando está configurado y usa la misma UI existente.

## Puesta en marcha

1. Crear un proyecto Supabase y habilitar Email/Password en Auth.
2. Aplicar la migración SQL desde Supabase CLI o el editor SQL.
3. Crear las cuentas Auth de los usuarios y añadir su `username` y `email` a `public.app_users`. No se deben importar contraseñas desde la hoja; cada usuario debe definir o restablecer su contraseña en Auth.
4. Desplegar las Edge Functions `login` y `api` con Supabase CLI. El CLI proporciona `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` al runtime de las funciones.
5. Configurar en `supabase-config.js` el Project URL y la clave anon/publishable del proyecto. Esta clave es pública; las tablas no permiten acceso directo y las funciones exigen sesión.
6. Habilitar GitHub Pages para la rama y carpeta donde vive `index.html`.
7. Probar login y operaciones con datos de prueba antes de migrar datos reales.

## Cuentas iniciales

Después de crear usuarios en **Supabase Auth**, registrar el nombre de acceso y correo asociados en `public.app_users`. La función `public.create_app_user` está restringida al rol `service_role` para altas controladas desde un entorno administrativo confiable. Nunca ejecutar operaciones administrativas desde el frontend.

## Migración de datos desde Sheets

El esquema no migra datos automáticamente. Exportar primero `Miembros`, `Deudas` y `Asistencia` como CSV, mapear/limpiar fechas y filas duplicadas, y cargar esos CSV en las tablas correspondientes. Verificar totales por tipo, saldos por persona y recuentos de asistencia antes de activar Supabase para usuarios. Mantener una copia de respaldo de las hojas durante la transición.

## Seguridad y límites conocidos

- Las contraseñas antiguas guardadas en la hoja no se pueden migrar como contraseñas de Auth; se requiere alta/invitación o restablecimiento individual.
- La política actual de la app es acceso compartido. Esta propuesta autentica a cada persona, pero todavía permite a todo usuario autenticado ver y modificar los datos de la comunidad. Antes de abrir el acceso a usuarios no confiables, añadir roles y reglas de autorización más finas.
- Las tablas tienen RLS habilitado y sin permisos directos para `anon`/`authenticated`; las Edge Functions verifican el JWT del usuario antes de usar su clave de servicio.
- El SQL inicial crea la función administrativa de alta con una restricción de rol. Revisar y aplicar las migraciones solamente al proyecto Supabase previsto.
- La clave anon puede estar en el frontend; la clave `service_role` y cualquier clave de proveedor externo deben permanecer como secretos de Edge Functions.
- Este cambio no importa filas ni cambia el backend activo hasta configurar y validar el proyecto Supabase.
