# 🚀 Daily Board (Project Hub)

Tablero ágil y centro de coordinación nativo sobre **GitHub Issues, Pull Requests y Milestones**.
100% estático, seguro y sin backend: corre íntegramente en el navegador del desarrollador mediante la API de GitHub y autenticación oficial Device Flow.

---

## ⚡ Instalación Mágica (One-Liner)

Parate en la terminal dentro de tu proyecto (nuevo o existente) y ejecutá:

```bash
curl -sL https://raw.githubusercontent.com/jmrodev/daily-board/main/install.sh | bash
```

El script se encarga de todo:
1. Detecta tu repositorio.
2. Inyecta `.github/workflows/board.yml`.
3. Activa **GitHub Pages** en modo GitHub Actions automáticamente (si tenés `gh` CLI autenticado).
4. Sube el commit a tu rama principal.

---

## 🛠️ Instalación Manual (Alternativa)
Creá el archivo `.github/workflows/board.yml` en tu proyecto:

```yaml
name: Deploy Project Board

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy-board:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Daily Board
        uses: actions/checkout@v4
        with:
          repository: jmrodev/daily-board
          ref: gh-pages
          path: ./board-site

      - name: Setup GitHub Pages
        uses: actions/configure-pages@v5

      - name: Upload Pages Artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./board-site

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 2. Habilitá GitHub Pages
En la configuración de tu repositorio en GitHub:
1. Andá a **Settings** → **Pages**.
2. En **Build and deployment** > **Source**, seleccioná **GitHub Actions**.

¡Listo! Tu tablero se desplegará en `https://<tu-usuario-u-org>.github.io/<tu-repo>/`.

---

## 🔒 Privacidad y Seguridad

- **Aislado e Independiente**: Corre bajo el dominio de GitHub Pages de tu propio proyecto.
- **Sin servidores intermedios**: La comunicación es directa entre tu navegador y la API oficial de GitHub (`api.github.com`).
- **Persistencia local**: Las sesiones y configuraciones se guardan aisladas en el `localStorage` de tu propio subdominio.
- **Siempre actualizado**: Tu tablero se mantiene al día con las últimas mejoras de Daily Board en cada despliegue sin que tengas que actualizar código manualmente.

---

## 🛠️ Funcionalidades Incluidas

- **📌 Tablero Kanban**: Arrastre de issues sincronizado con labels (`status:todo`, `status:in-progress`, `status:blocked`, `status:done`).
- **☕ Daily Scrum**: Registro de sincronización diaria estructurado directo en comentarios de GitHub.
- **💬 Canales / Novedades**: Vista rápida de hilos y discusiones activas del equipo.
- **📖 Docs / Wiki**: Renderizado en vivo de la documentación Markdown de tu carpeta `docs/`.
- **🎯 Sprints / Milestones**: Seguimiento visual del avance de metas y entregas.
