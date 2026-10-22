# 📌 Capítulo 03: Tablero Kanban y Labels

## 1. Mapeo Automático de Columnas
El tablero Kanban mapea las columnas directamente a etiquetas nativas de GitHub Issues:

| Columna | Label Requerido | Color Recomendado |
| :--- | :--- | :--- |
| **Por Hacer** | `status:todo` | `#cfd3d7` (Gris) |
| **En Curso** | `status:in-progress` | `#0969da` (Azul) |
| **Bloqueado** | `status:blocked` | `#cf222e` (Rojo) |
| **Hecho** | `status:done` | `#1a7f37` (Verde) |

## 2. Comportamiento Drag & Drop
- Al arrastrar una tarjeta entre columnas, la aplicación remueve la etiqueta anterior y asigna la nueva en GitHub mediante la API.
- Cuando una tarjeta pasa a la columna **Hecho**, el issue se cierra automáticamente en GitHub.
- Si una tarjeta se reabre moviéndola a **Por Hacer** o **En Curso**, el issue vuelve a estado `open`.
