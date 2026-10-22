# 🚀 Capítulo 02: Instalación y Despliegue

## 1. Instalación Automática (Recomendada)
Desde la raíz de cualquier repositorio local:

```bash
curl -sL https://raw.githubusercontent.com/jmrodev/daily-board/main/install.sh | bash
```

## 2. Instalación Manual
Si preferís configurar el workflow manualmente, creá `.github/workflows/board.yml`:

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

Luego en GitHub: **Settings** → **Pages** → en **Source** seleccioná **GitHub Actions**.
