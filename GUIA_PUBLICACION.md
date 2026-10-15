# EduControl v3.1 — Guía para ponerlo en internet

Núcleo Educativo Las Gamas · PHP + MySQL

## Qué trae el paquete

```
index.html            pantalla principal
css/  js/             diseño y lógica del navegador
api/                  servidor (PHP): login, incidencias, administración
  config.php          ← ÚNICO archivo que tienes que editar
database/schema.sql   estructura de la base de datos (limpia, con 1 cuenta admin)
database/datos_demo.sql   datos de prueba (SOLO para ensayar, no para el sistema real)
```

Cuenta inicial: usuario **admin** · contraseña **Admin#2026**
(el sistema te obliga a cambiarla en el primer ingreso).

---

## A. Probar primero en tu PC (XAMPP) — 10 minutos

1. Instala XAMPP, abre el panel y pulsa **Start** en Apache y MySQL.
2. Copia la carpeta `educontrol` dentro de `C:\xampp\htdocs\`.
3. Abre `http://localhost/phpmyadmin` → **Nueva** → nombre `educontrol`, cotejamiento `utf8mb4_unicode_ci` → Crear.
4. Con la base `educontrol` seleccionada: pestaña **Importar** → elige `database/schema.sql` → Continuar.
   (Opcional, para ensayar: importa también `database/datos_demo.sql`.)
5. Abre `http://localhost/educontrol/` → Administración → `admin` / `Admin#2026`.

En XAMPP no hay que tocar `config.php` (usa root sin contraseña).

---

## B. Subirlo a internet (hosting compartido con cPanel)

Necesitas un hosting con **PHP 8+ y MySQL** (cualquiera con cPanel sirve; para la defensa
también sirve uno gratuito tipo InfinityFree, aunque es más lento).

1. **Crear la base de datos** (cPanel → *Bases de datos MySQL*):
   - Crea una base (ej. `educontrol`) → el hosting le pondrá prefijo: `usuario_educontrol`.
   - Crea un usuario MySQL con **contraseña fuerte** y asígnalo a esa base con *Todos los privilegios*.
   - Anota los 3 datos: nombre de base, usuario, contraseña.
2. **Importar la estructura**: cPanel → *phpMyAdmin* → selecciona tu base → *Importar* → `database/schema.sql`.
   **No** importes `datos_demo.sql`.
3. **Subir los archivos**: administrador de archivos de cPanel → `public_html` → sube el ZIP y extráelo
   (o sube la carpeta por FTP). Debe quedar `public_html/index.html` y `public_html/api/...`.
   (Si lo pones en una subcarpeta, la dirección será `tudominio.com/subcarpeta/`; funciona igual.)
4. **Editar `api/config.php`** con tus 3 datos:
   ```php
   'db_name' => 'usuario_educontrol',
   'db_user' => 'usuario_mysql',
   'db_pass' => 'LaContraseñaFuerte',
   'https'   => true,     // cuando el sitio ya muestre el candado
   ```
5. **Activar HTTPS**: cPanel → *SSL/TLS Status* → *Run AutoSSL* (gratis). Luego deja `'https' => true`.
6. **Probar**: abre tu dirección → Administración → `admin` / `Admin#2026` → cambia la contraseña.
7. Si ves "No se pudo conectar a la base de datos": pon `'debug' => true` un momento para ver el motivo,
   corrige y vuelve a `false`.

### Requisitos del servidor (casi todos los hosting los tienen)
PHP 8.0 o superior con las extensiones `pdo_mysql` y `mbstring`. Se activan en cPanel → *Select PHP Version*.

---

## C. Cargar a toda la unidad educativa (lo más rápido)

Entra como **admin**:

1. **Pestaña "Alumnos y cursos" → Importar alumnos (CSV)**.
   Descarga la plantilla, llénala en Excel (columnas `ci ; nombre ; curso`) y guárdala como **CSV**.
2. **Pestaña "Usuarios" → Importar usuarios (CSV)**. Columnas: `usuario ; nombre ; rol ; ci_estudiante`
   - Docentes/directivos: `rol = docente` (el usuario lo escribes tú, ej. `prof.lopez`).
   - Alumnos: `rol = alumno` + CI del alumno (el usuario será su CI si lo dejas vacío).
   - Padres: `rol = padre` + CI de sus hijos separados por espacio (ej. `1234567 7654321`).
3. El sistema genera **contraseñas temporales** y te deja **descargar el CSV de credenciales**
   (solo se muestra una vez). Entrégalas a cada persona; al primer ingreso deberán cambiarla.
4. Si alguien olvida su clave: *Usuarios → Restablecer clave*.

---

## D. Seguridad (ya incluida)

- Contraseñas cifradas (bcrypt), cambio obligatorio en el primer ingreso.
- Bloqueo 10 min tras 5 intentos fallidos. Protección CSRF. Cookies seguras con HTTPS.
- Cada padre/alumno solo ve sus propios datos; solo docentes registran; solo admin gestiona usuarios.
- Las incidencias no se borran: se **anulan** y queda registro de quién y cuándo.
- Archivos internos (`config.php`, `conexion.php`, etc.) bloqueados por `.htaccess`.

## E. Respaldo (hazlo antes de la defensa y cada semana)

phpMyAdmin → tu base → **Exportar** → *Rápido* → SQL → Continuar. Guarda el archivo en tu USB y en tu correo.
Para restaurar: *Importar* ese mismo archivo en una base vacía.

## F. Lista de verificación para el día de la defensa

- [ ] Abrir la dirección desde tu celular con datos móviles (no solo desde tu PC).
- [ ] Tener 1 cuenta de cada perfil lista (admin, docente, padre, alumno) con contraseña conocida.
- [ ] Tener cargada una incidencia con citación para mostrar la **firma del apoderado**.
- [ ] Respaldo de la base en el USB y la versión local (XAMPP) como plan B si falla el internet.
