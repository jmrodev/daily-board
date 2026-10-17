# Guía del Curso y Metodología de Trabajo

Bienvenidos al espacio de trabajo colaborativo. Este documento se sincroniza automáticamente entre GitHub y nuestra web en GitHub Pages.

---

## 📌 1. Flujo de Trabajo (Git Workflow)

1. **Crear o tomar una tarea:** Elegí un issue del Tablero Kanban y movelo a **En Curso**.
2. **Crear una rama (branch):** Usá nombres descriptivos:
   - `feat/nombre-de-la-funcionalidad`
   - `fix/correccion-de-bug`
3. **Commits convencionales:**
   - `feat: agregar formulario de contacto`
   - `fix: corregir cálculo de fecha`
4. **Cierre automático de tareas:** Al abrir un Pull Request, incluí en la descripción `Fixes #numero_del_issue`. Cuando el PR sea aprobado y fusionado en `main`, GitHub moverá la tarea a **Listo** automáticamente.

---

## 💬 2. Pautas de Comunicación

- Las dudas técnicas y debates de arquitectura se registran en los comentarios de cada **Issue** para mantener trazabilidad.
- Las minutas de clase y guías de estudio se redactan en archivos Markdown dentro de la carpeta `/docs`.
