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



# Recorridos: nombre -> (URL, pasos). Un paso es ("esperar", ms), ("scroll", px) o ("tocar", selector).
RECORRIDOS = {
    "convocatoria-3d": (f"/match/call_for_match/{borrador.public_id}/", [("esperar", 1500), ("scroll", 900), ("esperar", 800), ("scroll", 900), ("esperar", 800)]),
    "enfrentamiento-cerrado-3d": (f"/match/call_for_match/{cerrado.public_id}/", [("esperar", 1500), ("scroll", 1100), ("esperar", 800), ("scroll", 1100), ("esperar", 800)]),
    "estadisticas-equipo": ("/data_analyse/team_statistics" + TEMP, [("esperar", 1200), ("scroll", 1000), ("esperar", 800), ("scroll", 1000), ("esperar", 800)]),
    "estadisticas-jugadores": ("/data_analyse/player_statistics" + TEMP, [("esperar", 1200), ("scroll", 900), ("esperar", 800)]),
    "estadisticas-pareja": (f"/data_analyse/pair_statistics{TEMP}&p1={pareja[0].public_id}&p2={pareja[1].public_id}", [("esperar", 1200), ("scroll", 900), ("esperar", 800)]),
    "plantilla": ("/players/roster/", [("esperar", 1200), ("scroll", 700), ("esperar", 800)]),
    "inicio-club": ("/core/club/", [("esperar", 1200), ("scroll", 900), ("esperar", 800)]),
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
            # El Chromium de este entorno no siempre trae el grabador de vídeo de Playwright: se hacen capturas
            # seguidas (con su marca de tiempo) y ffmpeg las une respetando el ritmo real.
            cuadros = tmp / "cuadros" / nombre
            cuadros.mkdir(parents=True, exist_ok=True)
            marcas = []
            ctx = navegador.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="es-ES")
            ctx.add_cookies([{"name": "sessionid", "value": cookie, "url": base}])
            pagina = ctx.new_page()
            r = pagina.goto(base + ruta, wait_until="networkidle")
            if not r or r.status >= 400:
                print(f"   ✖ {nombre}: HTTP {r.status if r else '?'}")
                ctx.close()
                continue
            pagina.add_style_tag(content=".z-bottom-nav{display:none!important}")
            t0 = time.time()

            def cuadro():
                f = cuadros / f"{len(marcas):05d}.jpg"
                pagina.screenshot(path=str(f), type="jpeg", quality=92)
                marcas.append(time.time() - t0)

            def esperar(ms):
                fin = time.time() + ms / 1000
                while time.time() < fin:
                    cuadro()

            for paso, valor in pasos:
                if paso == "esperar":
                    esperar(valor)
                elif paso == "scroll":
                    # Desplazamiento suave en pasos pequeños, como un dedo despacio.
                    for _ in range(30):
                        pagina.mouse.wheel(0, valor / 30)
                        cuadro()
                elif paso == "tocar":
                    pagina.tap(valor)
                    esperar(400)
            cuadro()
            ctx.close()
            lista = tmp / f"{nombre}.txt"
            lineas = []
            for i, m in enumerate(marcas):
                dur = (marcas[i + 1] - m) if i + 1 < len(marcas) else 0.5
                lineas.append(f"file '{(cuadros / f'{i:05d}.jpg').as_posix()}'\nduration {dur:.4f}")
            lineas.append(f"file '{(cuadros / f'{len(marcas) - 1:05d}.jpg').as_posix()}'")
            lista.write_text("\n".join(lineas), encoding="utf-8")
            destino = SALIDA / f"{nombre}.mp4"
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lista), "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "16", "-movflags", "+faststart", str(destino)], check=True)
            hechas.append(destino)
            print(f"   ✓ {nombre} ({len(marcas)} cuadros, {marcas[-1]:.1f} s)")
        navegador.close()
finally:
    servidor.terminate()
print(f"Listo: {len(hechas)} vídeos en {SALIDA}.")
