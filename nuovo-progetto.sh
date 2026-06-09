#!/usr/bin/env bash
#
# Crea un nuovo progetto guest book duplicando la factory (lo "stampo").
#
#   ./nuovo-progetto.sh <nome-cartella>
#   es:  ./nuovo-progetto.sh your-apartment-roma
#
# Copia tutto TRANNE: la cronologia git, le build (dist/ docs/), la cache Python,
# le foto demo di Catania e gli eventuali content.json. Il nuovo progetto nasce
# pulito, con template/ build.py GUIDA.md AVVIO-PROGETTO.md e gli strumenti del modulo.

set -euo pipefail

NAME="${1:-}"
if [ -z "$NAME" ]; then
  echo "Uso: ./nuovo-progetto.sh <nome-cartella>   (es. your-apartment-roma)" >&2
  exit 1
fi

SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$(dirname "$SRC")/$NAME"

if [ -e "$DEST" ]; then
  echo "✗ Esiste già: $DEST" >&2
  exit 1
fi

rsync -a \
  --exclude '.git' \
  --exclude 'dist' \
  --exclude 'docs' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude 'input/photos/*' \
  --exclude 'content.json' \
  --exclude 'content-*.json' \
  "$SRC/" "$DEST/"

mkdir -p "$DEST/input/photos"
touch "$DEST/input/photos/.gitkeep"

echo "✓ Nuovo progetto creato: $DEST"
echo
echo "Prossimi passi (vedi AVVIO-PROGETTO.md nella nuova cartella):"
echo "  1. metti dentro il content.json del cliente (dall'importer su Drive)"
echo "  2. scarica e rinomina le foto in input/photos/"
echo "  3. completa le sezioni locali, poi:  python3 build.py content.json"
