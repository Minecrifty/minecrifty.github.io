#!/usr/bin/env python3
"""Actualiza assets/js/videos.js con los videos y Shorts más recientes del canal.

Solo usa la librería estándar de Python y feeds públicos de YouTube (sin clave de API).
Uso:  python3 tools/update_videos.py
También lo ejecuta automáticamente .github/workflows/update-videos.yml cada pocas horas.
"""
import json, os, re, sys, urllib.request
import xml.etree.ElementTree as ET

HANDLE = "@Minecrifty"
LIMIT = 12
UA = {"User-Agent": "Mozilla/5.0 (compatible; MinecriftySite/1.0)", "Accept-Language": "en"}
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "js", "videos.js")
NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def channel_id():
    html = get(f"https://www.youtube.com/{HANDLE}")
    for pat in (r'"channelId":"(UC[\w-]{22})"', r'channel/(UC[\w-]{22})', r'"externalId":"(UC[\w-]{22})"'):
        m = re.search(pat, html)
        if m:
            return m.group(1)
    raise RuntimeError("No se pudo obtener el ID del canal")


def feed(playlist_id):
    root = ET.fromstring(get(f"https://www.youtube.com/feeds/videos.xml?playlist_id={playlist_id}"))
    out = []
    for e in root.findall("a:entry", NS):
        out.append({
            "id": e.find("yt:videoId", NS).text,
            "title": e.find("a:title", NS).text or "",
            "published": (e.find("a:published", NS).text or "")[:10],
        })
    return out


def main():
    cid = channel_id()
    base = cid[2:]
    data = {}
    # UULF = solo videos largos, UUSH = solo Shorts (listas automáticas de YouTube)
    for key, prefix in (("videos", "UULF"), ("shorts", "UUSH")):
        try:
            data[key] = feed(prefix + base)[:LIMIT]
        except Exception as ex:
            print(f"Aviso: no se pudo leer {key}: {ex}", file=sys.stderr)
            data[key] = []
    if not data["videos"] and not data["shorts"]:
        sys.exit("Sin datos: no se modifica videos.js")
    body = json.dumps(data, ensure_ascii=False, indent=2)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("/* Generado por tools/update_videos.py — no editar a mano. */\nwindow.SITE_VIDEOS = " + body + ";\n")
    print(f"OK: {len(data['videos'])} videos, {len(data['shorts'])} shorts")


if __name__ == "__main__":
    main()
