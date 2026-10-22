# 🛡️ Capítulo 06: Modelo de Seguridad, Datos y Privacidad

Este documento detalla el análisis exhaustivo de seguridad de **Daily Board (Project Hub)**, cubriendo el almacenamiento de datos, ciclo de vida de tokens, permisos de GitHub Actions y mitigación de vectores de ataque.

---

## 1. Arquitectura de Datos: Cero Backend / Cero Telemetría

- **Sin Servidores Intermedios**: Daily Board no posee servidores proxy, APIs intermedias ni bases de datos de terceros.
- **Tráfico Directo**: Toda llamada de red se realiza directamente desde el navegador del desarrollador hacia la API oficial de GitHub (`https://api.github.com`).
- **Sin Analíticas ni Rastreo**: No se inyectan librerías de tracking (Google Analytics, Mixpanel, etc.) ni se recolecta telemetría del equipo.

---

## 2. Gestión y Seguridad del Token de Acceso (OAuth Device Flow)

### Ciclo de Autenticación
1. Se utiliza el estándar **OAuth 2.0 Device Authorization Grant (RFC 8628)**, exactamente el mismo mecanismo que emplea la herramienta oficial `gh auth login`.
2. El usuario autoriza la aplicación directamente en el dominio oficial de GitHub (`https://github.com/login/device`), por lo que sus credenciales de usuario y contraseñas **nunca pasan por la interfaz del tablero**.

### Alcance de Permisos (Scope)
- **Scope solicitado:** `repo`
- **Para qué se utiliza:** Leer y escribir Issues (mover tarjetas en el Kanban), registrar comentarios (Daily Scrum) y leer la documentación Markdown de `/docs`.
- **Qué NO puede hacer:** No tiene acceso a facturación, claves SSH, secretos del repositorio, ajustes organizacionales ni acciones administrativas de cuenta.

### Dónde y Cómo se Almacena el Token
- El `access_token` otorgado por GitHub se guarda **únicamente en el `localStorage` del navegador del desarrollador**.
- **Aislamiento por Origen (Same-Origin Policy):** Como el tablero corre bajo el dominio de Pages del propio proyecto (`https://<tu-org>.github.io/<tu-repo>/`), el almacenamiento local queda aislado bajo ese subdominio. Ningún otro sitio web en internet tiene acceso a leer ese `localStorage`.
- **Revocación Inmediata:** El desarrollador puede revocar el acceso en cualquier momento desde su panel de GitHub:  
  *GitHub → Settings → Applications → Authorized OAuth Apps → Revoke*.

---

## 3. Seguridad del Workflow de GitHub Actions (`board.yml`)

El archivo `.github/workflows/board.yml` sigue las mejores prácticas de seguridad recomendadas por GitHub:

### Permisos Mínimos Necesarios (Principle of Least Privilege)
```yaml
permissions:
  contents: read   # Solo lectura para descargar el repositorio
  pages: write      # Publicar los artefactos estáticos en GitHub Pages
  id-token: write   # Autenticar de forma segura el despliegue con OIDC
```
- **Sin acceso a Secretos:** El workflow **no** consume ni expone secretos del repositorio (`secrets.GITHUB_TOKEN` o variables de entorno sensibles).
- **Entorno Confinado:** Corre en una máquina virtual efímera (`ubuntu-latest`) administrada por GitHub que se destruye inmediatamente tras el despliegue.

---

## 4. Integridad del Código y Dependencias

- **Sin Build Steps Complejos:** No requiere pipelines opacos de compilación que descarguen miles de paquetes npm sin verificar.
- **Renderizado de Markdown Seguro:** Utiliza `marked.js` vía CDN con sanitización de contenido para prevenir ataques de Cross-Site Scripting (XSS) al visualizar issues o documentación.
- **Transparencia Total:** Tanto el código fuente de la aplicación como el script de instalación son de código abierto y completamente auditables.
