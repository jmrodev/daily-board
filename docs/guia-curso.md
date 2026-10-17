# Guía del Curso y Metodología de Trabajo

Bienvenidos al espacio de trabajo colaborativo. Este documento se sincroniza automáticamente entre GitHub y nuestra web en GitHub Pages.

---

## 📌 1. Flujo de Trabajo y Reglas del Tablero (Git Workflow)

### Paso 1: Tomar una Tarea (Responsable Obligatorio)
- Elegí un issue de la columna **📌 Por Hacer**.
- **Regla estricta:** Ninguna tarea puede estar en **⚡ En Curso** sin un responsable.
- Al arrastrarla a *En Curso*, el tablero te consultará si te la asignás a vos mismo (`@usuario`). También podés usar el botón **➕ Asignarme** en la tarjeta.

### Paso 2: Crear una Rama de Trabajo (Branch)
Trabajá siempre en una rama aislada a partir de `main`:
- `feat/nombre-de-la-funcionalidad`
- `fix/correccion-de-bug`

### Paso 3: Commits Convencionales
Usá mensajes claros y estandarizados:
- `feat: agregar formulario de contacto`
- `fix: corregir validacion de formulario`
- `docs: actualizar guia de trabajo`

### Paso 4: Abrir Pull Request (PR) y Vinculación
- Abrí el PR contra la rama `main`.
- En la descripción del PR incluí obligatoriamente la referencia al issue:
  ```markdown
  Fixes #numero_del_issue
  ```
- Al abrir el PR, el tablero marcará automáticamente la tarjeta con el badge púrpura `🔀 PR #X (⏳ 0/2 aprobados)`.

### Paso 5: Regla de Revisores (Code Review obligatorio de 2 pares)
- Para que un Pull Request pueda ser aceptado y fusionado (*merged*), se requieren **al menos 2 revisiones aprobadas (APPROVED)** por compañeros o docentes.
- El tablero muestra en vivo el avance de las revisiones (`⏳ 0/2`, `⏳ 1/2`, `⏳ 2/2 aprobados`).
- Cualquiera del equipo puede participar como revisor para sugerir mejoras o aprobar cambios.

### Paso 6: Paso a "Listo" Protegido
- **Nadie puede arrastrar manualmente tarjetas a la columna "Listo".**
- La columna **🎉 Listo / PR Aceptado 🔒** se actualiza de forma automática únicamente cuando el docente o administrador fusiona el PR tras cumplir las revisiones.
- Cada tarjeta terminada muestra la insignia `👑 Aceptado por @usuario` con el crédito de quien revisó y aprobó la entrega.

---

## 💬 2. Pautas de Comunicación y Dailies

- **Daily Scrum:** Registrá tu reporte diario desde la solapa **☕ Daily Scrum** contestando las 3 preguntas antes de comenzar la jornada.
- **Debates de tareas:** Las dudas puntuales, capturas o avances se dejan en el botón **💬 Comentarios** de cada issue para mantener trazabilidad directa con GitHub.
- **Documentación:** Nuevos tutoriales y guías de arquitectura se agregan desde la solapa **📖 Docs / Wiki**.
