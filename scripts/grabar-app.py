"""Graba en vídeo vertical recorridos de la app de Zyra con los datos de demostración (club ZYRA CLUB).

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
ap.add_argument("--salida", default=str(AQUI / "grabaciones-app"))
ap.add_argument("--catalogo", action="store_true", help="copiar los vídeos a public/medios/ y añadirlos a capturas.json para que la app los use al generar")
ap.add_argument("--solo", nargs="*", help="grabar solo estos recorridos (por nombre)")
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



FPS = 60  # mínimo que se pide para los vídeos
LENTO = 2.2  # los desplazamientos van despacio (da tiempo a leer y a hacer zoom); las pausas también respiran
DESCRIPCIONES = {
    "convocatoria-3d": "Ficha de un enfrentamiento por convocar con el VS en 3D, los escudos de los dos equipos, la cuenta atrás y los pasos Convocatoria, Parejas, Resultados y Acta, y la previa del rival",
    "enfrentamiento-cerrado-3d": "Ficha de un enfrentamiento ya cerrado con el marcador en 3D y el resultado, los botones Compartir resultado y Ver estadísticas, y la convocatoria de jugadores",
    "estadisticas-equipo": "Estadísticas del equipo en una temporada: balance de victorias, empates y derrotas, porcentaje, forma reciente y racha, ganados como local y visitante y puntos por enfrentamiento",
    "estadisticas-jugadores": "Estadísticas de jugadores: buscador y tabla de la plantilla con partidos, porcentaje de victorias y porcentaje de «se apunta»",
    "estadisticas-jugador-ficha": "Estadísticas de un jugador en la temporada: puntos, puesto en el equipo, pareja habitual, porcentaje de victorias, balance, partidos jugados y racha actual",
    "estadisticas-pareja": "Estadísticas por parejas: dos buscadores de jugador y la lista de todas las parejas con partidos, V-D y porcentaje de victorias",
    "plantilla": "Gestionar plantilla: buscador, filtros Todos/En el equipo/Fuera, botones Activar visibles y Desactivar visibles y un interruptor por jugador",
    "inicio-club": "Inicio del club: botones Invitar, Crear rival, Nuevo jugador y Crear enfrentamiento, y las tarjetas de Miembros e invitaciones y Datos del equipo",
    "recorrido-equipo": "Recorrido por la app: inicio del club, gestionar plantilla, lista de enfrentamientos con sus resultados y estadísticas del equipo, pasando de una pantalla a otra",
}


def registrar(nombre, destino, seg):
    """Copia el vídeo a public/medios/ y lo añade (o actualiza) en capturas.json, con el formato de una entrada por línea."""
    import shutil
    rel = f"medios/app-{nombre}.mp4"
    (AQUI / "public" / "medios").mkdir(parents=True, exist_ok=True)
    shutil.copyfile(destino, AQUI / "public" / rel)
    ruta = AQUI / "capturas.json"
    cat = json.loads(ruta.read_text(encoding="utf-8"))
    entrada = {"src": rel, "descripcion": DESCRIPCIONES.get(nombre, nombre), "video": True, "imgW": 780, "imgH": 1688, "seg": round(seg, 1), "scroll": [0, 0]}
    cat = [c for c in cat if c["src"] != rel] + [entrada]
    ruta.write_text("[\n" + ",\n".join("  " + json.dumps(c, ensure_ascii=False) for c in cat) + "\n]\n", encoding="utf-8")

# Recorridos: nombre -> (URL de partida, pasos). Pasos: ("esperar", ms), ("scroll", px[, segundos]), ("ir", ruta) o ("tocar", selector).
# Cada fotograma se hace con el tiempo parado: el desplazamiento avanza exactamente 1/30 s por imagen, así que el vídeo sale a 30 fps
# parejos aunque cada captura tarde lo que tarde (grabar «en directo» daba 10-15 fps y tirones).
RECORRIDOS = {
    "convocatoria-3d": (f"/match/call_for_match/{borrador.public_id}/", [("esperar", 1000), ("scroll", 900, 1.6), ("esperar", 600), ("scroll", 900, 1.6), ("esperar", 600)]),
    "enfrentamiento-cerrado-3d": (f"/match/call_for_match/{cerrado.public_id}/", [("esperar", 1000), ("scroll", 1100, 1.8), ("esperar", 600), ("scroll", 1100, 1.8), ("esperar", 600)]),
    "estadisticas-equipo": ("/data_analyse/team_statistics" + TEMP, [("esperar", 1000), ("scroll", 1000, 1.8), ("esperar", 600), ("scroll", 1000, 1.8), ("esperar", 600)]),
    "estadisticas-jugadores": ("/data_analyse/player_statistics" + TEMP, [("esperar", 1000), ("scroll", 900, 1.8), ("esperar", 600)]),
    "estadisticas-jugador-ficha": (f"/data_analyse/player_statistics{TEMP}&player={jugador.public_id}", [("esperar", 1000), ("scroll", 900, 1.8), ("esperar", 600)]),
    "estadisticas-pareja": (f"/data_analyse/pair_statistics{TEMP}&p1={pareja[0].public_id}&p2={pareja[1].public_id}", [("esperar", 1000), ("scroll", 900, 1.8), ("esperar", 600)]),
    "plantilla": ("/players/roster/", [("esperar", 1000), ("scroll", 700, 1.6), ("esperar", 600)]),
    "inicio-club": ("/core/club/", [("esperar", 1000), ("scroll", 900, 1.8), ("esperar", 600)]),
    "recorrido-equipo": ("/core/club/", [("esperar", 900), ("scroll", 500, 1.2), ("ir", "/players/roster/"), ("esperar", 700), ("scroll", 500, 1.2),
                                         ("ir", "/match/list_match" + TEMP), ("esperar", 700), ("scroll", 500, 1.2),
                                         ("ir", "/data_analyse/team_statistics" + TEMP), ("esperar", 700), ("scroll", 700, 1.4), ("esperar", 500)]),
}
if args.solo:
    RECORRIDOS = {k: v for k, v in RECORRIDOS.items() if k in args.solo}

print("3/3 Grabando…")
s = socket.socket()
s.bind(("127.0.0.1", 0))
puerto = s.getsockname()[1]
s.close()
base = f"http://127.0.0.1:{puerto}"
servidor = subprocess.Popen([sys.executable, "manage.py", "runserver", f"127.0.0.1:{puerto}", "--noreload"], cwd=ZYRA, env=os.environ, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
SALIDA.mkdir(parents=True, exist_ok=True)
hechas = []
CSS = ".z-bottom-nav{position:fixed!important}"
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
        for nombre, (ruta, pasos) in RECORRIDOS.items():
            cuadros = tmp / "cuadros" / nombre
            cuadros.mkdir(parents=True, exist_ok=True)
            n = [0]
            ctx = navegador.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="es-ES")
            ctx.add_cookies([{"name": "sessionid", "value": cookie, "url": base}])
            pagina = ctx.new_page()

            def abrir(r_):
                r = pagina.goto(base + r_, wait_until="networkidle")
                if not r or r.status >= 400:
                    return False
                pagina.add_style_tag(content=CSS)
                return True

            def cuadro():
                pagina.screenshot(path=str(cuadros / f"{n[0]:05d}.jpg"), type="jpeg", quality=93)
                n[0] += 1

            if not abrir(ruta):
                print(f"   ✖ {nombre}: no carga")
                ctx.close()
                continue
            for paso in pasos:
                tipo = paso[0]
                if tipo == "esperar":
                    for _ in range(round(paso[1] * 1.4 * FPS / 1000)):
                        cuadro()
                elif tipo == "scroll":
                    px = paso[1]
                    total = max(1, round((paso[2] if len(paso) > 2 else 1.5) * LENTO * FPS))
                    y0 = pagina.evaluate("window.scrollY")
                    for k in range(1, total + 1):
                        t = k / total
                        e = t * t * (3 - 2 * t)  # arranca y frena suave
                        pagina.evaluate(f"window.scrollTo(0, {y0 + px * e})")
                        cuadro()
                elif tipo == "ir":
                    abrir(paso[1])
                elif tipo == "tocar":
                    pagina.tap(paso[1])
                    for _ in range(round(0.4 * FPS)):
                        cuadro()
            cuadro()
            ctx.close()
            destino = SALIDA / f"{nombre}.mp4"
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", str(cuadros / "%05d.jpg"), "-vf", "format=yuv420p", "-c:v", "libx264", "-crf", "15", "-movflags", "+faststart", str(destino)], check=True)
            hechas.append(destino)
            if args.catalogo:
                registrar(nombre, destino, n[0] / FPS)
            print(f"   ✓ {nombre} ({n[0]} cuadros, {n[0] / FPS:.1f} s a {FPS} fps)")
        navegador.close()
finally:
    servidor.terminate()
print(f"Listo: {len(hechas)} vídeos en {SALIDA}.")
