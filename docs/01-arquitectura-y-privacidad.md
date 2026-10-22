# 🏗️ Capítulo 01: Arquitectura y Privacidad

## 1. Principios del Sistema
Daily Board está diseñado como una aplicación **Client-Side First** (100% estática):
- **Cero Backend Propio**: No almacena datos en bases externas ni intermediarios.
- **Single Source of Truth**: Todos los datos (tareas, estados, notas diarias y documentación) viven nativamente en tu repositorio de GitHub como Issues, Pull Requests, Milestones y archivos Markdown.
- **Soberanía Total**: La aplicación corre alojada en el GitHub Pages del propio proyecto, garantizando que el equipo tenga control total del código servido.

## 2. Autenticación Segura (GitHub Device Flow)
- Utiliza el estándar oficial de OAuth Device Flow (el mismo de `gh auth login`).
- El usuario autoriza en `github.com/login/device` ingresando un código único.
- El token personal se preserva de forma aislada en el `localStorage` del navegador bajo el namespace exacto del proyecto.
- Nunca se comparten credenciales entre diferentes repositorios o dominios.
