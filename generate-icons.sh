#!/bin/bash

# Exit on error
set -e

SOURCE_IMAGE="assets/stock_game.png"
FRONTEND_PUBLIC="frontend/public"

echo "Generating icons from $SOURCE_IMAGE..."

# Create icons in different sizes
convert "$SOURCE_IMAGE" -resize 16x16 "$FRONTEND_PUBLIC/icon-16.png"
convert "$SOURCE_IMAGE" -resize 32x32 "$FRONTEND_PUBLIC/icon-32.png"
convert "$SOURCE_IMAGE" -resize 48x48 "$FRONTEND_PUBLIC/icon-48.png"

# Combine into favicon.ico
convert "$FRONTEND_PUBLIC/icon-16.png" "$FRONTEND_PUBLIC/icon-32.png" "$FRONTEND_PUBLIC/icon-48.png" "$FRONTEND_PUBLIC/favicon.ico"

# Create other formats
convert "$SOURCE_IMAGE" -resize 180x180 "$FRONTEND_PUBLIC/apple-touch-icon.png"
convert "$SOURCE_IMAGE" -resize 192x192 "$FRONTEND_PUBLIC/icon-192.png"
convert "$SOURCE_IMAGE" -resize 512x512 "$FRONTEND_PUBLIC/icon-512.png"

# Cleanup temporary files
rm "$FRONTEND_PUBLIC/icon-16.png" "$FRONTEND_PUBLIC/icon-32.png" "$FRONTEND_PUBLIC/icon-48.png"

echo "Icons generated successfully in $FRONTEND_PUBLIC"
