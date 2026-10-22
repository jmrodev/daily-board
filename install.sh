#!/usr/bin/env bash
set -e

# Colores para la salida
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   🚀 Instalador Mágico de Daily Board (Project Hub)   ${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. Verificar si estamos en un repositorio Git
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: No estás dentro de un repositorio Git.${NC}"
    echo "Navegá hasta la raíz de tu proyecto y volvé a ejecutar este comando."
    exit 1
fi

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

# Obtener slug del remoto (owner/repo)
REMOTE_URL=$(git remote get-url origin 2>/dev/null || true)
REPO_SLUG=""
if [[ "$REMOTE_URL" =~ github\.com[:/]([^/]+)/([^/.]+)(\.git)?$ ]]; then
    REPO_SLUG="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
fi

echo -e "📦 Repositorio detectado: ${GREEN}${REPO_SLUG:-"Local"}${NC}"

# 2. Crear el workflow de despliegue
WORKFLOW_DIR=".github/workflows"
WORKFLOW_FILE="$WORKFLOW_DIR/board.yml"

mkdir -p "$WORKFLOW_DIR"

cat <<'EOF' > "$WORKFLOW_FILE"
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
EOF

echo -e "✓ Creado: ${GREEN}$WORKFLOW_FILE${NC}"

# 3. Intentar habilitar GitHub Pages automáticamente vía GitHub CLI (gh)
PAGES_ENABLED=false
if command -v gh >/dev/null 2>&1 && [ -n "$REPO_SLUG" ]; then
    echo -e "⚙️  Configurando GitHub Pages automáticamente con gh CLI..."
    if gh api -X POST "repos/$REPO_SLUG/pages" -f build_type=workflow >/dev/null 2>&1; then
        echo -e "✓ ${GREEN}GitHub Pages habilitado en modo GitHub Actions con éxito.${NC}"
        PAGES_ENABLED=true
    elif gh api "repos/$REPO_SLUG/pages" >/dev/null 2>&1; then
        # Ya existía Pages, asegurarse que use workflow
        gh api -X PUT "repos/$REPO_SLUG/pages" -f build_type=workflow >/dev/null 2>&1 || true
        echo -e "✓ ${GREEN}GitHub Pages actualizado a modo GitHub Actions.${NC}"
        PAGES_ENABLED=true
    fi
fi

if [ "$PAGES_ENABLED" = false ]; then
    echo -e "${YELLOW}ℹ️  Paso manual restante:${NC}"
    echo "   En GitHub: Settings -> Pages -> Source: 'GitHub Actions'."
fi

# 4. Ofrecer hacer commit y push
echo ""
read -p "¿Deseas commitear y pushear el workflow a origin main ahora? (s/N): " RESP
if [[ "$RESP" =~ ^[sSyY]$ ]]; then
    CURRENT_BRANCH=$(git branch --show-current)
    git add "$WORKFLOW_FILE"
    git commit -m "ci: deploy Daily Board to GitHub Pages"
    git push origin "$CURRENT_BRANCH"
    echo -e "${GREEN}✓ Cambios subidos a origin $CURRENT_BRANCH.${NC}"
    if [ -n "$REPO_SLUG" ]; then
        OWNER=$(echo "$REPO_SLUG" | cut -d'/' -f1)
        REPO=$(echo "$REPO_SLUG" | cut -d'/' -f2)
        echo -e "🎉 Tu tablero estará disponible en unos segundos en:"
        echo -e "   👉 ${BLUE}https://${OWNER}.github.io/${REPO}/${NC}"
    fi
else
    echo -e "${YELLOW}Workflow guardado. Hacé 'git add $WORKFLOW_FILE && git commit' cuando quieras activarlo.${NC}"
fi

echo -e "${GREEN}¡Listo!${NC}"
