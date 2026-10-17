# Classroom Board (GitHub-Native Kanban & Daily Scrum)

Tablero Kanban ágil y ligero para el aula, alojado 100% en **GitHub Pages** e interactuando directamente con la **API de GitHub**.

## 🚀 Características

- **Sin servidores ni bases de datos externas:** Los datos son los **GitHub Issues** reales de tu repositorio.
- **Kanban interactivo:** Columnas *Por Hacer*, *En Curso*, *Bloqueado* y *Listo*.
- **Drag & Drop:** Al arrastrar tarjetas entre columnas, se actualizan las etiquetas (`status:in-progress`, `status:blocked`, etc.) o el estado (`open`/`closed`) en GitHub automáticamente.
- **Creación de Issues:** Creá nuevas tareas directamente desde la interfaz web hacia el repositorio.
- **Vínculo directo:** Hacé click en cualquier tarjeta para abrir la discusión y el historial del issue en GitHub.

## 🛠️ Cómo Usarlo en GitHub Pages

1. Subí este código a la rama `main` de tu repositorio.
2. En GitHub, andá a **Settings** → **Pages**.
3. En **Source**, seleccioná la rama `main` y la carpeta `/ (root)`. Guardá los cambios.
4. Entrá a la URL que te genera GitHub Pages.
5. Hacé click en **⚙️ Configuración** e ingresá:
   - Dueño u Organización (ej. `jmrodev`)
   - Nombre del Repositorio
   - Un Personal Access Token (PAT) con permisos de `repo`.
