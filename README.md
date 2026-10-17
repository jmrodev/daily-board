# 🚀 Project Hub (Classroom Agile Management)

Tablero ágil y centro de colaboración para equipos y cursos de desarrollo, alojado al **100% en GitHub Pages** con integración bidireccional directa a la **API de GitHub** (sin backend, sin bases de datos externas, cero costo).

Diseñado específicamente para reemplazar herramientas complejas (Jira, Plaky, Trello o backends pesados en AWS), garantizando que todo el flujo educativo ocurra en GitHub.

---

## 🌟 Módulos y Solapas Integradas

1. **📌 Tablero Kanban:**
   - Columnas: *📌 Por Hacer*, *⚡ En Curso / PR Pedido*, *🚧 Bloqueado* y *🎉 Listo / PR Aceptado 🔒*.
   - **Regla estricta de asignación:** No se puede pasar una tarjeta a *En Curso* sin responsable. Si la tarjeta está sin asignar, el tablero ofrece autoasignársela a quien la arrastra.
   - **Promoción automática por Pull Request:** Al abrir un PR con `Fixes #X`, la tarjeta se vincula de inmediato y pasa a *En Curso* con el badge púrpura `🔀 PR #X (⏳ 0/2 aprobados)`.
   - **Métricas de Code Review en vivo:** Muestra el progreso de revisiones aprobadas (`0/2`, `1/2`, `2/2`).
   - **Columna "Listo" blindada:** Ningún usuario puede mover tarjetas manualmente a *Listo*. Se mueven solas cuando el PR se aprueba por los revisores y se fusiona (*merged*) en GitHub, mostrando la etiqueta `👑 Aceptado por @usuario`.
   - **Discusión interactiva:** Cada tarjeta tiene el botón `💬` para leer y responder comentarios de GitHub Issues en tiempo real sin salir del tablero.
   - **Filtro rápido:** Menú desplegable para ver todas las tareas, solo las mías, tareas sin asignar, o filtrar por un compañero específico.

2. **☕ Daily Scrum:**
   - Registro diario con las 3 preguntas ágiles: *¿Qué hiciste ayer?*, *¿Qué vas a hacer hoy?*, *¿Tenés algún bloqueo?*.
   - Se guardan automáticamente como archivos Markdown ordenados cronológicamente en `/dailies/YYYY-MM-DD.md` dentro del repositorio mediante commits con la identidad del estudiante.

3. **📖 Docs / Wiki:**
   - Visualizador y editor de documentación Markdown centralizado en la carpeta `/docs/`.
   - Permite a docentes y alumnos crear guías, minutas o arquitecturas desde la interfaz.

4. **🎯 Sprints / Milestones:**
   - Visualización de objetivos y metas del curso vinculados directamente con los Milestones de GitHub.
   - Barra de progreso porcentual basada en issues abiertos y cerrados.

5. **⚡ Actividad:**
   - Feed en vivo con el historial de commits recientes, autores, ramas y enlaces directos a los diffs en GitHub.

---

## 📋 Reglas de Flujo del Curso

| Estado / Columna | Quién lo acciona | Requisitos | Efecto en GitHub |
| :--- | :--- | :--- | :--- |
| **📌 Por Hacer** | Docente / Alumnos | Crear nuevo issue | Etiqueta `status:todo` |
| **⚡ En Curso** | Alumno | Debe tener **responsable asignado** | Etiqueta `status:in-progress` |
| **⏳ PR Pedido** | Alumno | Abrir PR con `Fixes #issue_id` | Badge púrpura + contador de 2 revisiones |
| **🚧 Bloqueado** | Alumno | Inconveniente o duda técnica | Etiqueta `status:blocked` |
| **🎉 Listo / PR Aceptado** | Admin / Revisor | **Merge en GitHub** tras 2 reviews | Se cierra el issue + `👑 Aceptado por @user` |

---

## 🚀 Despliegue en GitHub Pages (en 2 minutos)

1. Hacé un fork o cloná este repositorio en tu cuenta de GitHub.
2. En GitHub, andá a **Settings** → **Pages**.
3. En **Source**, seleccioná la rama `main` y la carpeta `/ (root)`. Guardá los cambios.
4. Entrá a la URL pública que te entrega GitHub Pages.
5. Hacé click en **🔑 Iniciar Sesión** en la esquina superior derecha:
   - Podés generar tu Personal Access Token con 1 solo click (con permisos de `repo`).
   - La sesión se guarda de forma segura en el `localStorage` del navegador.
