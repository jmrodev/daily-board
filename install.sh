#!/usr/bin/env bash
set -e

# Colores ANSI para terminal
CYAN='\033[0;36m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

clear 2>/dev/null || true

echo -e "${CYAN}${BOLD}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║           🚀 INSTALADOR MÁGICO — DAILY BOARD / PROJECT HUB        ║${NC}"
echo -e "${CYAN}${BOLD}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}📌 ¿QUÉ HACE ESTE SCRIPT?${NC}"
echo -e "   Despliega un tablero ágil (Kanban, Daily Scrum, Sprints y Wiki)"
echo -e "   directamente en el ${GREEN}GitHub Pages de tu propio repositorio${NC}."
echo -e "   - 100% estático, sin servidores ajenos y totalmente privado."
echo -e "   - No mezcla código ajeno en tu repo (solo inyecta un workflow en .github/)."
echo ""
echo -e "${BOLD}⚠️  REQUISITO FUNDAMENTAL:${NC}"
echo -e "   Debés estar parado en la ${YELLOW}raíz del repositorio local${NC} donde querés el tablero."
echo -e "   Directorio actual: ${CYAN}$(pwd)${NC}"
echo ""

# 1. Verificar si estamos dentro de un repo Git
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: No estás dentro de un repositorio Git.${NC}"
    echo -e "Navegá con 'cd' hasta la carpeta de tu proyecto y volvé a correr este comando."
    exit 1
fi

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

# Detectar slug remoto (owner/repo)
REMOTE_URL=$(git remote get-url origin 2>/dev/null || true)
REPO_SLUG=""
if [[ "$REMOTE_URL" =~ github\.com[:/]([^/]+)/([^/.]+)(\.git)?$ ]]; then
    REPO_SLUG="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
fi

echo -e "📦 Repositorio detectado: ${GREEN}${REPO_SLUG:-"Git Local (sin remoto origin GitHub)"}${NC}"
echo ""
read -p "¿Deseas instalar Daily Board en este proyecto? (s/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[sSyY]$ ]]; then
    echo -e "${YELLOW}Operación cancelada por el usuario.${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}▶ 1/3 Generando workflow de GitHub Actions...${NC}"

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
echo ""

# 2. Configuración de GitHub Pages
echo -e "${BLUE}▶ 2/3 Configurando GitHub Pages...${NC}"

PAGES_CONFIGURED=false

if command -v gh >/dev/null 2>&1; then
    # Verificar si gh CLI está autenticado
    if gh auth status >/dev/null 2>&1 && [ -n "$REPO_SLUG" ]; then
        echo -e "⚙️  GitHub CLI detectado y autenticado. Configurando vía API..."
        if gh api -X POST "repos/$REPO_SLUG/pages" -f build_type=workflow >/dev/null 2>&1; then
            echo -e "✓ ${GREEN}GitHub Pages habilitado en modo GitHub Actions exitosamente.${NC}"
            PAGES_CONFIGURED=true
        elif gh api "repos/$REPO_SLUG/pages" >/dev/null 2>&1; then
            gh api -X PUT "repos/$REPO_SLUG/pages" -f build_type=workflow >/dev/null 2>&1 || true
            echo -e "✓ ${GREEN}GitHub Pages actualizado a modo GitHub Actions.${NC}"
            PAGES_CONFIGURED=true
        fi
    fi
fi

if [ "$PAGES_CONFIGURED" = false ]; then
    echo -e "${YELLOW}ℹ️  No se pudo configurar GitHub Pages de forma automática (gh CLI no instalado o sin sesión).${NC}"
    echo ""
    echo -e "${BOLD}👉 PASOS MANUALES NECESARIOS EN GITHUB:${NC}"
    echo -e "   1. Abrí tu repositorio en el navegador:"
    if [ -n "$REPO_SLUG" ]; then
        echo -e "      ${CYAN}https://github.com/$REPO_SLUG/settings/pages${NC}"
    else
        echo -e "      ${CYAN}https://github.com/<tu-usuario>/<tu-repo>/settings/pages${NC}"
    fi
    echo -e "   2. En la sección ${BOLD}'Build and deployment' -> 'Source'${NC}:"
    echo -e "      Seleccioná la opción: ${GREEN}'GitHub Actions'${NC} (en lugar de 'Deploy from a branch')."
    echo -e "   3. ¡Listo! No necesitás tocar nada más."
    echo ""
fi

# 3. Commit y Push
echo -e "${BLUE}▶ 3/3 Publicación de cambios...${NC}"
read -p "¿Deseas commitear y pushear el archivo a GitHub ahora? (s/N): " PUSH_CONFIRM

if [[ "$PUSH_CONFIRM" =~ ^[sSyY]$ ]]; then
    CURRENT_BRANCH=$(git branch --show-current || echo "main")
    git add "$WORKFLOW_FILE"
    git commit -m "ci: deploy Daily Board to GitHub Pages"
    git push origin "$CURRENT_BRANCH"
    echo -e "${GREEN}✓ Workflow subido exitosamente a origin/$CURRENT_BRANCH.${NC}"
    echo ""
    echo -e "${CYAN}${BOLD}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}${BOLD}║                     🎉 ¡DESPLIEGUE EN CURSO!                      ║${NC}"
    echo -e "${CYAN}${BOLD}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    if [ -n "$REPO_SLUG" ]; then
        OWNER=$(echo "$REPO_SLUG" | cut -d'/' -f1)
        REPO=$(echo "$REPO_SLUG" | cut -d'/' -f2)
        echo -e "En 1 a 2 minutos tu tablero estará en línea en:"
        echo -e "👉 ${BOLD}${GREEN}https://${OWNER}.github.io/${REPO}/${NC}"
        echo ""
        echo -e "Podés ver el avance de la compilación en:"
        echo -e "🔗 ${CYAN}https://github.com/${REPO_SLUG}/actions${NC}"
    fi
else
    echo ""
    echo -e "${YELLOW}Workflow guardado localmente.${NC}"
    echo -e "Cuando quieras activarlo, ejecutá:"
    echo -e "   git add $WORKFLOW_FILE"
    echo -e "   git commit -m \"ci: deploy Daily Board to GitHub Pages\""
    echo -e "   git push origin main"
fi

echo ""
echo -e "${GREEN}¡Proceso finalizado!${NC}"
