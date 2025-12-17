#!/bin/bash

# Script pro generování ikon aplikace z původního loga
# Vyžaduje ImageMagick: brew install imagemagick

SOURCE="public/icons/logo-original.png"
OUTPUT_DIR="public/icons"

if [ ! -f "$SOURCE" ]; then
    echo "❌ Soubor $SOURCE nenalezen!"
    echo "Prosím uložte logo jako: $SOURCE"
    exit 1
fi

echo "🎨 Generuji ikony z $SOURCE..."

# Favicon sizes
convert "$SOURCE" -resize 16x16 "$OUTPUT_DIR/icon-16x16.png"
convert "$SOURCE" -resize 32x32 "$OUTPUT_DIR/icon-32x32.png"
convert "$SOURCE" -resize 48x48 "$OUTPUT_DIR/icon-48x48.png"

# PWA icons
convert "$SOURCE" -resize 72x72 "$OUTPUT_DIR/icon-72x72.png"
convert "$SOURCE" -resize 96x96 "$OUTPUT_DIR/icon-96x96.png"
convert "$SOURCE" -resize 128x128 "$OUTPUT_DIR/icon-128x128.png"
convert "$SOURCE" -resize 144x144 "$OUTPUT_DIR/icon-144x144.png"
convert "$SOURCE" -resize 152x152 "$OUTPUT_DIR/icon-152x152.png"
convert "$SOURCE" -resize 192x192 "$OUTPUT_DIR/icon-192x192.png"
convert "$SOURCE" -resize 384x384 "$OUTPUT_DIR/icon-384x384.png"
convert "$SOURCE" -resize 512x512 "$OUTPUT_DIR/icon-512x512.png"

# Apple Touch Icon
convert "$SOURCE" -resize 180x180 "$OUTPUT_DIR/apple-touch-icon.png"

# Favicon ICO (multi-size)
convert "$SOURCE" -resize 16x16 "$OUTPUT_DIR/favicon-16.png"
convert "$SOURCE" -resize 32x32 "$OUTPUT_DIR/favicon-32.png"
convert "$SOURCE" -resize 48x48 "$OUTPUT_DIR/favicon-48.png"
convert "$OUTPUT_DIR/favicon-16.png" "$OUTPUT_DIR/favicon-32.png" "$OUTPUT_DIR/favicon-48.png" "public/favicon.ico"
rm "$OUTPUT_DIR/favicon-16.png" "$OUTPUT_DIR/favicon-32.png" "$OUTPUT_DIR/favicon-48.png"

echo "✅ Ikony vygenerovány!"
echo ""
echo "Vytvořené soubory:"
ls -la "$OUTPUT_DIR"/*.png
ls -la public/favicon.ico



