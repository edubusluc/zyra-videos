#!/usr/bin/env bash
# Quita el fondo de un vídeo (persona sobre transparente) con backgroundremover (MIT, gratis, local) y lo deja en .webm con alfa.
# Uso: scripts/recortar.sh entrada.mp4 public/medios/recorte.webm
# Requisitos: pip install backgroundremover (descarga el modelo la 1.ª vez) y ffmpeg. Tarda: mejor clips de pocos segundos.
set -euo pipefail
in="$1"; out="$2"; tmp="$(mktemp -d)/recorte.mov"
backgroundremover -i "$in" -tv -m u2net_human_seg -o "$tmp"
ffmpeg -y -i "$tmp" -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 2M "$out"
echo "Listo: $out  (úsalo como \"recorte\": \"medios/$(basename "$out")\")"
