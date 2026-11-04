#!/usr/bin/env bash
set -e

INSTALL_DIR="${HOME}/.local/bin"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${DAILY_BOARD_PORT:-8085}"

echo "🚀 Instalando Daily Board CLI..."

mkdir -p "${INSTALL_DIR}"

cat << WRAPPEREOF > "${INSTALL_DIR}/daily-board"
#!/usr/bin/env bash
SRC_DIR="${SRC_DIR}"
PORT="${PORT}"

# Buscar si ya está corriendo en el puerto
if lsof -Pi :"\${PORT}" -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "🟢 Daily Board ya está corriendo en http://localhost:\${PORT}"
else
    echo "🚀 Levantando Daily Board en http://localhost:\${PORT}..."
    (cd "\${SRC_DIR}" && python3 -m http.server "\${PORT}" > /dev/null 2>&1) &
    sleep 0.5
fi

# Abrir en el navegador predeterminado
if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:\${PORT}" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
    open "http://localhost:\${PORT}"
fi

echo "✅ Daily Board abierto en http://localhost:\${PORT}"
WRAPPEREOF

chmod +x "${INSTALL_DIR}/daily-board"

echo "✅ Instalado con éxito en ${INSTALL_DIR}/daily-board"
echo "💡 Ahora puedes ejecutar 'daily-board' en tu terminal desde cualquier lugar."
