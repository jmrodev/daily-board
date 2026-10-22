# 🚀 Daily Board (Project Hub)

Tablero ágil y centro de sincronización para equipos sobre **GitHub Issues, Pull Requests y Milestones**.

---

## ⚡ Instalación Mágica (One-Liner)

Parate en la terminal dentro de tu proyecto y ejecutá:

```bash
curl -sL https://raw.githubusercontent.com/jmrodev/daily-board/main/install.sh | bash
```

El script se encarga de:
1. Inyectar `.github/workflows/board.yml`.
2. Activar GitHub Pages en modo Actions automáticamente.
3. Desplegar tu tablero en `https://<org>.github.io/<repo>/`.

---

## 📖 Documentación y Wiki

Las guías completas organizadas por capítulos están disponibles en la carpeta [`docs/`](docs/) y se renderizan automáticamente dentro de la solapa **Docs / Wiki** de tu tablero:

- [Capítulo 01: Arquitectura y Privacidad](docs/01-arquitectura-y-privacidad.md)
- [Capítulo 02: Instalación y Despliegue](docs/02-instalacion-y-despliegue.md)
- [Capítulo 03: Tablero Kanban y Labels](docs/03-tablero-kanban-y-labels.md)
- [Capítulo 04: Sincronización Daily Scrum](docs/04-sincronizacion-daily-scrum.md)
- [Capítulo 05: Wiki y Gestión Documental](docs/05-wiki-y-gestion-documental.md)
