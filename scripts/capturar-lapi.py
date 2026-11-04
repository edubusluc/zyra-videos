"""Captura las pantallas de un equipo de la LAPI en la web de Zyra y las añade al catálogo de capturas (sufijo -lapi).

Las capturas de capturar-app.py son de un equipo SNP (puntos SNP, 5 partidos, enfrentamientos). Un equipo LAPI se ve distinto:
sin puntos SNP, 3 partidos de 1 punto, tipos Liga, Playoffs y Fase final, jornada y puntos de liga (4, 3 o 1).

    cd /ruta/a/zyra-videos
    /ruta/a/Zyra/.venv/bin/python scripts/capturar-lapi.py --zyra /ruta/a/Zyra

Igual que capturar-app.py: base SQLite temporal, datos anonimizados (ZYRA CLUB, JUGADOR n, EQUIPO RIVAL n), móvil de 390 px a ×2.
Usa CHROME=/ruta/a/chrome si no tienes el navegador de Playwright.
"""
import argparse
import datetime
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

AQUI = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("--zyra", required=True, help="carpeta del proyecto Zyra (donde está manage.py)")
ap.add_argument("--salida", default=str(AQUI / "capturas-app"))
ap.add_argument("--sin-catalogo", action="store_true", help="solo hacer las capturas, sin tocar capturas.json")
args = ap.parse_args()
ZYRA = Path(args.zyra).resolve()
SALIDA = Path(args.salida)
if not (ZYRA / "manage.py").exists():
    sys.exit(f"No encuentro manage.py en {ZYRA}")

tmp = Path(tempfile.mkdtemp(prefix="zyra-lapi-"))
os.environ.update({
    "DJANGO_DEBUG": "True", "DATABASE_URL": f"sqlite:///{(tmp / 'demo.sqlite3').as_posix()}", "RATE_LIMITS_ENABLED": "False",
    "DJANGO_SETTINGS_MODULE": "zyra.settings",
})
os.chdir(ZYRA)
sys.path.insert(0, str(ZYRA))

print("1/4 Base de datos de demostración…")
subprocess.run([sys.executable, "manage.py", "migrate", "-v0"], cwd=ZYRA, check=True, env=os.environ, stdout=subprocess.DEVNULL)

print("2/4 Equipo LAPI con datos inventados…")
import django  # noqa: E402

django.setup()
from django.contrib.auth import get_user_model  # noqa: E402
from django.test import Client  # noqa: E402
from call.models import Call  # noqa: E402
from match.models import Game, Match, Result  # noqa: E402
from core.services import create_club  # noqa: E402
from players.models import Player  # noqa: E402
from team.models import Team  # noqa: E402

User = get_user_model()
user = User.objects.create_user("demo", email="demo@example.com")
user.set_unusable_password()
user.save()
club = create_club("ZYRA CLUB", "", user, competition="lapi")
propio = club.own_team
propio.division = "lapi_2"
propio.save()
posiciones = [v for v, _l in Player.POSITIONS if v != "NONE"] or ["NONE"]
manos = [v for v, _l in Player.HAND if v != "NONE"] or ["NONE"]
jugadores = [
    Player.objects.create(club=club, team=propio, name=f"JUGADOR {i + 1}", last_name="", position=posiciones[i % len(posiciones)],
                          skillfull_hand=manos[i % len(manos)], joined_season="2026-2027")
    for i in range(9)
]
rivales = [Team.objects.create(club=club, name=f"EQUIPO RIVAL {i + 1}", location="", in_group=True, division=d)
           for i, d in enumerate(["lapi_2", "lapi_2", "lapi_2", "lapi_2"])]
PAREJAS = [(0, 1), (2, 3), (4, 5), (6, 7), (0, 8), (1, 2), (3, 4), (5, 6)]
SETS_GANA = [(6, 3, 6, 4), (6, 2, 6, 3), (7, 5, 6, 4), (6, 4, 7, 6)]
SETS_PIERDE = [(3, 6, 4, 6), (2, 6, 4, 6), (5, 7, 3, 6), (4, 6, 6, 7)]
dia = datetime.date(2026, 10, 3)


def partido(rival, tipo, dias, own, rv, jornada=None, cerrado=True):
    """Enfrentamiento con ``own``-``rv`` partidos ganados (3 en total), parejas que rotan y resultados por sets."""
    m = Match.objects.create(club=club, local=propio, visiting=rival, start_date=dia + datetime.timedelta(days=dias), match_type=tipo,
                             round_number=jornada, draft_mode=True)
    if not cerrado:
        return m
    base = len(Match.objects.filter(club=club)) * 3
    for n in range(1, 4):
        a, b = PAREJAS[(base + n) % len(PAREJAS)]
        gana = n <= own
        g = Game.objects.create(match=m, n_game=n, score=1, draft_mode=False, winner="Local" if gana else "Visitante",
                                player_1_local=jugadores[a], player_2_local=jugadores[b])
        s = (SETS_GANA if gana else SETS_PIERDE)[(base + n) % 4]
        Result.objects.create(game=g, result="Victoria Local" if gana else "Victoria Visitante", set1_local=s[0], set1_visiting=s[1],
                              set2_local=s[2], set2_visiting=s[3], draft_mode=False)
    llamada = Call.objects.create(match=m, draft_mode=False)  # convocatoria: los jugadores que han jugado
    llamada.players.set({jugadores[i] for n in range(1, 4) for i in PAREJAS[(base + n) % len(PAREJAS)]})
    m.result_points = f"{own}/{rv}"
    m.result = "Victoria Local" if own > rv else "Victoria Visitante"
    m.draft_mode = False
    m.save()
    return m


liga = [(0, 3, 0), (7, 2, 1), (14, 3, 0), (21, 1, 2), (28, 2, 1), (35, 3, 0)]
for k, (d, o, r) in enumerate(liga):
    partido(rivales[k % 4], "liga", d, o, r, jornada=k + 1)
cerrado = Match.objects.filter(club=club, draft_mode=False).order_by("-start_date").first()
borrador = partido(rivales[1], "liga", 42, 0, 0, jornada=7, cerrado=False)
print(f"   {len(jugadores)} jugadores, {len(rivales)} rivales, {Match.objects.filter(club=club).count()} enfrentamientos LAPI.")

cliente = Client()
cliente.force_login(user)
cookie = cliente.cookies["sessionid"].value
pareja = (jugadores[0], jugadores[1])
TEMP = "?season=2026-2027"
DESCRIPCIONES = {
    "inicio-club-lapi": "Configuración del club ZYRA CLUB de la liga LAPI: botones Invitar, Crear rival, Nuevo jugador y Crear enfrentamiento, y tarjetas de Miembros e invitaciones y Datos del equipo",
    "jugadores-lapi": "Plantilla de un equipo de la liga LAPI: buscador, orden por nombre, vista en cuadrícula o lista; cada tarjeta muestra posición y mano del jugador (sin puntos SNP)",
    "equipos-lapi": "Equipos rivales de la liga LAPI con buscador, interruptor para ver solo los de mi grupo y tarjetas con escudo y etiqueta En tu grupo",
    "nuevo-enfrentamiento-lapi": "Formulario Crear enfrentamiento de la liga LAPI: el tipo se elige entre Liga, Playoffs y Fase final, con jornada, rival, en casa o fuera, fecha, hora y lugar",
    "enfrentamientos-lapi": "Enfrentamientos de la liga LAPI: lista de jornadas con rival, tipo Liga, resultado de partidos (3-0, 2-1, 1-2) y V o D, con vista Lista o Calendario y filtros",
    "enfrentamiento-borrador-lapi": "Enfrentamiento de liga LAPI por convocar: marcador VS, progreso de los pasos (convocatoria, parejas, resultados y acta) y botón Siguiente: crear convocatoria",
    "enfrentamiento-cerrado-lapi": "Enfrentamiento de liga LAPI cerrado: resultado por partidos (tres partidos de un punto), victoria, botones Compartir resultado y Ver estadísticas, y la convocatoria",
    "estadisticas-equipo-lapi": "Estadísticas de un equipo de la liga LAPI: balance de la temporada, puntos de liga (4 por ganar 3-0, 3 por ganar 2-1, 1 por perder), forma reciente y racha, con pestañas Equipo, Jugadores, Parejas y Rivales",
    "estadisticas-jugador-lapi": "Estadísticas de jugadores de la liga LAPI: buscador y tabla de la plantilla con partidos y porcentaje de victorias, sin puntos SNP",
    "estadisticas-pareja-lapi": "Estadísticas por parejas de la liga LAPI: dos buscadores de jugador, botón Ver pareja y la lista de todas las parejas con partidos, V-D y porcentaje de victorias",
}
PAGINAS = [
    ("inicio-club-lapi", "/core/club/"),
    ("jugadores-lapi", "/players/list_players"),
    ("equipos-lapi", "/team/list_teams"),
    ("nuevo-enfrentamiento-lapi", "/match/create_match"),
    ("enfrentamientos-lapi", "/match/list_match" + TEMP),
    ("enfrentamiento-borrador-lapi", f"/match/call_for_match/{borrador.public_id}/"),
    ("enfrentamiento-cerrado-lapi", f"/match/call_for_match/{cerrado.public_id}/"),
    ("estadisticas-equipo-lapi", "/data_analyse/team_statistics" + TEMP),
    ("estadisticas-jugador-lapi", "/data_analyse/player_statistics" + TEMP),
    ("estadisticas-pareja-lapi", "/data_analyse/pair_statistics" + TEMP),
]

print("3/4 Capturando…")
s = socket.socket()
s.bind(("127.0.0.1", 0))
puerto = s.getsockname()[1]
s.close()
base_url = f"http://127.0.0.1:{puerto}"
servidor = subprocess.Popen([sys.executable, "manage.py", "runserver", f"127.0.0.1:{puerto}", "--noreload"], cwd=ZYRA, env=os.environ,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
SALIDA.mkdir(parents=True, exist_ok=True)
hechas = []
try:
    for _ in range(60):
        try:
            urllib.request.urlopen(base_url + "/healthz/", timeout=2)
            break
        except Exception:
            time.sleep(1)
    else:
        sys.exit("El servidor no arrancó.")
    from playwright.sync_api import sync_playwright

    with sync_playwright() as pw:
        navegador = pw.chromium.launch(executable_path=os.environ.get("CHROME") or None)
        ctx = navegador.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="es-ES")
        ctx.add_cookies([{"name": "sessionid", "value": cookie, "url": base_url}])
        pagina = ctx.new_page()
        for nombre, ruta in PAGINAS:
            r = pagina.goto(base_url + ruta, wait_until="networkidle")
            if not r or r.status >= 400:
                print(f"   ✖ {nombre}: HTTP {r.status if r else '?'}")
                continue
            pagina.add_style_tag(content="*{animation:none!important;transition:none!important}.z-bottom-nav{display:none!important}")
            pagina.wait_for_timeout(400)
            destino = SALIDA / f"{nombre}.png"
            pagina.screenshot(path=str(destino), full_page=True)
            hechas.append(destino)
            print(f"   ✓ {nombre}")
        navegador.close()
finally:
    servidor.terminate()

print("4/4 Catálogo…")
if hechas and not args.sin_catalogo:
    descs = tmp / "descripciones.json"
    descs.write_text(json.dumps({f"{n}.png": d for n, d in DESCRIPCIONES.items()}, ensure_ascii=False), encoding="utf-8")
    subprocess.run(["node", "scripts/captura.mjs", *map(str, hechas), "--descs", str(descs)], cwd=AQUI, check=True)
print(f"Listo: {len(hechas)} capturas en {SALIDA}. Mira las imágenes antes de fiarte de las descripciones de capturas.json.")
