#!/bin/bash
# SessionStart hook: prepara el entorno para sesiones de Claude Code (web/móvil).
# Instala dependencias para que lint y build funcionen sin configuración manual.
set -euo pipefail

# Solo en el entorno remoto (Claude Code on the web). En local no hace falta.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Idempotente: npm install es seguro de repetir y aprovecha el cache del contenedor.
npm install
