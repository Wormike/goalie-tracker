#!/bin/bash

# Script pro generování ikon aplikace z původního loga (macOS)
# Používá vestavěný nástroj sips

SOURCE="public/icons/logo-original.png"
OUTPUT_DIR="public/icons"

if [ ! -f "$SOURCE" ]; then
    echo "❌ Soubor $SOURCE nenalezen!"
    echo "Prosím uložte logo jako: $SOURCE"
    exit 1
fi

echo "🎨 Generuji ikony z $SOURCE..."

# Funkce pro resize
resize_icon() {
    local size=$1
    local output=$2
    cp "$SOURCE" "$output"
    sips -z $size $size "$output" --out "$output" > /dev/null 2>&1
}

# Favicon sizes
resize_icon 16 "$OUTPUT_DIR/icon-16x16.png"
resize_icon 32 "$OUTPUT_DIR/icon-32x32.png"

# PWA icons
resize_icon 72 "$OUTPUT_DIR/icon-72x72.png"
resize_icon 96 "$OUTPUT_DIR/icon-96x96.png"
resize_icon 128 "$OUTPUT_DIR/icon-128x128.png"
resize_icon 144 "$OUTPUT_DIR/icon-144x144.png"
resize_icon 152 "$OUTPUT_DIR/icon-152x152.png"
resize_icon 192 "$OUTPUT_DIR/icon-192x192.png"
resize_icon 384 "$OUTPUT_DIR/icon-384x384.png"
resize_icon 512 "$OUTPUT_DIR/icon-512x512.png"

# Apple Touch Icon
resize_icon 180 "$OUTPUT_DIR/apple-touch-icon.png"

# Favicon ICO - použijeme 32x32 verzi
cp "$OUTPUT_DIR/icon-32x32.png" "public/favicon.ico"

echo "✅ Ikony vygenerovány!"
echo ""
echo "Vytvořené soubory:"
ls -la "$OUTPUT_DIR"/*.png 2>/dev/null
ls -la public/favicon.ico 2>/dev/null


















