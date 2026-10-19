"""Captura las pantallas de la app de Zyra con datos de demostración y las añade al catálogo de capturas.

Se ejecuta con el Python del proyecto Zyra (el que tiene Django y Playwright instalados):

    cd /ruta/a/zyra-videos
    /ruta/a/Zyra/.venv/bin/python scripts/capturar-app.py --zyra /ruta/a/Zyra

Qué hace, sin tocar tu base de datos real ni el repositorio de Zyra:
1. Crea una base SQLite temporal, la migra y carga los datos de partida (populate_db.py).
2. Los anonimiza: club «ZYRA CLUB», jugadores «JUGADOR 1…», rivales «EQUIPO RIVAL n», sin escudos ni lugares.
3. Arranca el servidor en local, entra como capitán y hace una captura de cada pantalla (móvil 390 px, ×2).
4. Las guarda en capturas-app/ y las añade a capturas.json con su descripción (node scripts/captura.mjs).
"""
import argparse
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

tmp = Path(tempfile.mkdtemp(prefix="zyra-demo-"))
os.environ.update({
    "DJANGO_DEBUG": "True", "DATABASE_URL": f"sqlite:///{(tmp / 'demo.sqlite3').as_posix()}", "RATE_LIMITS_ENABLED": "False",
    "DJANGO_SETTINGS_MODULE": "zyra.settings",
})
os.chdir(ZYRA)
sys.path.insert(0, str(ZYRA))


def run(*a):
    subprocess.run([sys.executable, *a], cwd=ZYRA, check=True, env=os.environ, stdout=subprocess.DEVNULL)


print("1/4 Base de datos de demostración…")
run("manage.py", "migrate", "-v0")
run("populate_db.py", "--usuario", "demo", "--email", "demo@example.com", "--sin-contrasena")

print("2/4 Anonimizando…")
import django  # noqa: E402

django.setup()
from django.test import Client  # noqa: E402
from django.contrib.auth import get_user_model  # noqa: E402
from core.models import Club  # noqa: E402
from match.models import Match  # noqa: E402
from players.models import Player  # noqa: E402
from team.models import Team  # noqa: E402

Club.objects.update(name="ZYRA CLUB")
n = 0
for t in Team.objects.order_by("id"):
    if t.is_own:
        t.name = "ZYRA CLUB"
    else:
        n += 1
        t.name = f"EQUIPO RIVAL {n}"
    t.photo = ""
    t.location = ""
    t.save()
for i, p in enumerate(Player.objects.order_by("id"), 1):
    p.name, p.last_name = f"JUGADOR {i}", ""
    p.save()
Match.objects.update(location="", rival_name="")

User = get_user_model()
user = User.objects.get(username="demo")
cliente = Client()
cliente.force_login(user)
cookie = cliente.cookies["sessionid"].value
propio = Team.objects.filter(is_own=True, in_group=True).first() or Team.objects.filter(is_own=True).first()
jugador = Player.objects.filter(team=propio).order_by("id").first() or Player.objects.order_by("id").first()
cerrado = Match.objects.filter(draft_mode=False, season="2025-2026").order_by("-start_date").first() or Match.objects.filter(draft_mode=False).order_by("-start_date").first()
borrador = Match.objects.filter(draft_mode=True).order_by("-start_date").first() or cerrado
# pareja propia que más veces ha jugado junta
from collections import Counter  # noqa: E402
from match.models import Game  # noqa: E402

propios = set(Player.objects.filter(team=propio).values_list("id", flat=True))
veces = Counter()
for g in Game.objects.all():
    for a, b in ((g.player_1_local_id, g.player_2_local_id), (g.player_1_visiting_id, g.player_2_visiting_id)):
        if a in propios and b in propios:
            veces[frozenset((a, b))] += 1
pareja = [Player.objects.get(id=i) for i in sorted(veces.most_common(1)[0][0])] if veces else [jugador, jugador]
TEMP = "?season=2025-2026"
print(f"   {Player.objects.count()} jugadores, {Team.objects.count()} equipos, {Match.objects.count()} enfrentamientos.")

# nombre del archivo, URL, qué espera mostrar (la descripción definitiva se revisa a mano en capturas.json)
DESCRIPCIONES = {
    "inicio-club": "Inicio del club ZYRA CLUB: tarjetas de miembros e invitaciones, Mi equipo y Rivales, con botones para invitar, añadir jugador, crear rival y crear enfrentamiento",
    "jugadores": "Lista de jugadores del club con buscador, orden por nombre o puntos SNP, y botones Gestionar plantilla y Nuevo jugador; cada tarjeta muestra posición, mano y puntos SNP",
    "ficha-jugador": "Perfil de un jugador: puntos SNP, forma reciente (V/D) y últimos partidos, con pestañas Resumen y Estadísticas",
    "plantilla": "Gestionar plantilla: lista de jugadores con interruptor para activar o desactivar los que están en el equipo, filtros Todos/En el equipo/Fuera y botón Guardar cambios",
    "nuevo-jugador": "Formulario Crear jugador: nombre, apellidos, posición, mano hábil, temporada en que se unió al equipo y foto",
    "equipos": "Rivales: lista de equipos rivales con botones Gestionar equipos y Nuevo rival, e interruptor para ver solo los de mi grupo",
    "nuevo-equipo": "Formulario Crear equipo rival: nombre, localización, si está en el grupo, categoría, nacionalidad, división y foto",
    "gestionar-equipos": "Gestionar equipos: cambiar categoría, nacionalidad, división y grupo de varios rivales a la vez y guardar los cambios",
    "nuevo-enfrentamiento": "Formulario Crear enfrentamiento: tipo, equipo rival, si juega en casa o fuera, fecha, hora y lugar",
    "enfrentamientos": "Lista de enfrentamientos como tarjetas, con filtro por temporada y tipo (competitivos o amistosos), contadores de jugados, ganados, empatados y perdidos, y el resultado de cada uno",
    "enfrentamiento-borrador": "Enfrentamiento en borrador con los 4 pasos Convocatoria, Parejas, Resultados y Acta, y el botón Siguiente: crear convocatoria",
    "enfrentamiento-cerrado": "Enfrentamiento cerrado con acta: resultado 9-3 y victoria, los 4 pasos completados, botones Compartir resultado y Ver estadísticas, y la convocatoria de 10 jugadores agrupados por posición",
    "estadisticas-equipo": "Estadísticas del equipo en una temporada: balance de victorias, empates y derrotas, porcentaje de enfrentamientos ganados, juegos como local y visitante, y pestañas Resumen, Top 5, Partidos y sets, Récords",
    "estadisticas-jugador": "Estadísticas de jugadores: buscador y lista de jugadores para abrir la ficha de estadísticas de uno",
    "estadisticas-jugador-ficha": "Estadísticas de un jugador en la temporada: partidos jugados, porcentaje de victorias, racha actual y rendimiento",
    "estadisticas-pareja": "Estadísticas por parejas: se eligen dos jugadores para ver cómo rinden juntos y aparece el listado de parejas destacadas",
    "estadisticas-pareja-ficha": "Estadísticas de una pareja concreta: partidos juntos, porcentaje de victorias y opción de ver las mejores y peores parejas",
    "miembros": "Miembros del club: tu cuenta de capitán, explicación de roles e invitaciones de jugadores por email o con enlace",
    "mi-perfil": "Mi perfil: cuenta (email, nombre de perfil, acceso con Google) y preferencias del informe PDF de la convocatoria",
}

PAGINAS = [
    ("inicio-club", "/core/club/"),
    ("jugadores", "/players/list_players"),
    ("ficha-jugador", f"/players/player_details/{jugador.public_id}/"),
    ("plantilla", "/players/roster/"),
    ("nuevo-jugador", "/players/create_player"),
    ("equipos", "/team/list_teams"),
    ("nuevo-equipo", "/team/create_team"),
    ("gestionar-equipos", "/team/manage_teams/"),
    ("nuevo-enfrentamiento", "/match/create_match"),
    ("enfrentamientos", "/match/list_match" + TEMP),
    ("enfrentamiento-borrador", f"/match/call_for_match/{borrador.public_id}/"),
    ("enfrentamiento-cerrado", f"/match/call_for_match/{cerrado.public_id}/"),
    ("estadisticas-equipo", "/data_analyse/team_statistics" + TEMP),
    ("estadisticas-jugador", "/data_analyse/player_statistics" + TEMP),
    ("estadisticas-jugador-ficha", f"/data_analyse/player_statistics{TEMP}&player={jugador.public_id}"),
    ("estadisticas-pareja", "/data_analyse/pair_statistics" + TEMP),
    ("estadisticas-pareja-ficha", f"/data_analyse/pair_statistics{TEMP}&p1={pareja[0].public_id}&p2={pareja[1].public_id}"),
    ("miembros", "/core/members/"),
    ("mi-perfil", "/core/profile/"),
]

print("3/4 Capturando…")
s = socket.socket()
s.bind(("127.0.0.1", 0))
puerto = s.getsockname()[1]
s.close()
base = f"http://127.0.0.1:{puerto}"
servidor = subprocess.Popen([sys.executable, "manage.py", "runserver", f"127.0.0.1:{puerto}", "--noreload"], cwd=ZYRA, env=os.environ, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
SALIDA.mkdir(parents=True, exist_ok=True)
hechas = []
try:
    for _ in range(60):
        try:
            urllib.request.urlopen(base + "/healthz/", timeout=2)
            break
        except Exception:
            time.sleep(1)
    else:
        sys.exit("El servidor no arrancó.")
    from playwright.sync_api import sync_playwright

    with sync_playwright() as pw:
        navegador = pw.chromium.launch(executable_path=os.environ.get("CHROME") or None)
        ctx = navegador.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="es-ES")
        ctx.add_cookies([{"name": "sessionid", "value": cookie, "url": base}])
        pagina = ctx.new_page()
        for nombre, ruta in PAGINAS:
            r = pagina.goto(base + ruta, wait_until="networkidle")
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
print(f"Listo: {len(hechas)} capturas en {SALIDA}. Revisa las descripciones de capturas.json: son lo que lee Claude para elegir pantalla.")
