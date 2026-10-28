import json
import os
from PIL import Image, ImageDraw, ImageFont

OUT = r"C:\Users\igorl\OneDrive\Documentos\online-rpg\backend\content\midgard-ecos\fields"
os.makedirs(OUT, exist_ok=True)

PARCHMENT = (239, 229, 205)
INK = (48, 39, 29)
GRID = (196, 180, 148)
ROAD = (160, 121, 77)
ACCENT = (133, 82, 46)


def font(size, bold=False):
    path = "C:/Windows/Fonts/georgiab.ttf" if bold else "C:/Windows/Fonts/georgia.ttf"
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


MAPS = [
    {
        "id": "campos-de-prontera", "name": "Campos de Prontera", "width": 28, "height": 20,
        "parent": "prontera", "published": True,
        "points": [
            ("campos-ponte", "Ponte de Pedra", 14, 5),
            ("campos-moinho", "Moinho Velho", 6, 9),
            ("campos-acampamento", "Acampamento de Caravanas", 21, 10),
            ("campos-trilha", "Trilha dos Ecos", 12, 15),
            ("campos-ruina", "Ruína do Marco", 24, 17),
        ],
    },
    {
        "id": "floresta-de-payon", "name": "Floresta de Payon", "width": 26, "height": 20,
        "parent": "payon", "published": True,
        "points": [
            ("floresta-clareira", "Clareira dos Caçadores", 13, 6),
            ("floresta-santuario", "Santuário de Pedra", 5, 9),
            ("floresta-trilha", "Trilha das Pegadas", 19, 11),
            ("floresta-caverna", "Boca da Caverna", 16, 16),
            ("floresta-acampamento", "Acampamento Suspenso", 8, 15),
        ],
    },
    {
        "id": "deserto-de-morroc", "name": "Deserto de Morroc", "width": 30, "height": 20,
        "parent": "morroc", "published": True,
        "points": [
            ("deserto-dunas", "Mar de Dunas", 7, 7),
            ("deserto-caravana", "Rota das Caravanas", 17, 9),
            ("deserto-piramide", "Pirâmide Soterrada", 24, 13),
            ("deserto-oasis", "Oásis Partido", 12, 16),
            ("deserto-tempestade", "Olho da Tempestade", 21, 5),
        ],
    },
    {
        "id": "pantano-de-comodo", "name": "Pântano de Comodo", "width": 26, "height": 20,
        "parent": "comodo", "published": True,
        "points": [
            ("pantano-passarela", "Passarela de Tábuas", 8, 6),
            ("pantano-lago", "Lago Parado", 17, 7),
            ("pantano-gruta", "Gruta das Marés", 21, 14),
            ("pantano-acampamento", "Acampamento dos Pescadores", 6, 14),
            ("pantano-farol", "Farol Afogado", 14, 17),
        ],
    },
    {
        "id": "campos-de-geffen", "name": "Campos de Geffen", "width": 26, "height": 20,
        "parent": "geffen", "published": True,
        "points": [
            ("geffen-campos-pedra", "Pedra de Fluxo", 7, 6),
            ("geffen-campos-oficina", "Oficina Abandonada", 18, 8),
            ("geffen-campos-trilha", "Trilha Arcana", 21, 15),
            ("geffen-campos-ruina", "Ruína do Observador", 11, 16),
            ("geffen-campos-portal", "Portal Instável", 6, 13),
        ],
    },
    {
        "id": "minas-de-glast-heim", "name": "Minas de Glast Heim", "width": 24, "height": 20,
        "parent": "glast-heim", "published": False,
        "points": [
            ("minas-entrada", "Entrada da Galeria", 12, 17),
            ("minas-galeria", "Galeria dos Ecos", 7, 11),
            ("minas-veio", "Veio de Prata", 18, 9),
            ("minas-altar", "Altar Subterrâneo", 6, 5),
            ("minas-saida", "Saída Selada", 19, 15),
        ],
    },
    {
        "id": "estrada-de-juno", "name": "Estrada de Juno", "width": 28, "height": 20,
        "parent": "juno", "published": True,
        "points": [
            ("estrada-posto", "Posto da Guarda", 5, 7),
            ("estrada-aqueduto", "Aqueduto Antigo", 14, 6),
            ("estrada-biblioteca", "Marco da Biblioteca", 22, 9),
            ("estrada-cruzamento", "Cruzamento dos Sábios", 13, 14),
            ("estrada-ruina", "Ruína do Mensageiro", 23, 17),
        ],
    },
    {
        "id": "passo-de-moscovia", "name": "Passo de Moscóvia", "width": 26, "height": 20,
        "parent": "midgard", "published": True,
        "points": [
            ("passo-portao", "Portão do Norte", 13, 6),
            ("passo-neve", "Campo de Neve", 6, 9),
            ("passo-ponte", "Ponte de Gelo", 20, 10),
            ("passo-abrigo", "Abrigo dos Viajantes", 8, 16),
            ("passo-altar", "Altar do Inverno", 19, 16),
        ],
    },
]

for spec in MAPS:
    cell = 40
    width = spec["width"] * cell
    height = spec["height"] * cell
    image = Image.new("RGB", (width, height), PARCHMENT)
    draw = ImageDraw.Draw(image)
    for x in range(0, spec["width"] + 1):
        draw.line((x * cell, 100, x * cell, height - 1), fill=GRID, width=1)
    for y in range(0, spec["height"] + 1):
        draw.line((0, 100 + (y * (height - 120)) // spec["height"], width, 100 + (y * (height - 120)) // spec["height"]), fill=GRID, width=1)
    draw.rectangle((0, 0, width - 1, height - 1), outline=INK, width=4)
    draw.rectangle((24, 20, width - 24, 92), fill=(247, 240, 224), outline=ACCENT, width=2)
    draw.text((40, 28), spec["name"], fill=INK, font=font(34, True))
    draw.text((42, 70), "MIDGARD  ·  mapa de campo esquemático", fill=ACCENT, font=font(16))
    for pid, label, px, py in spec["points"]:
        x = px * cell
        y = 100 + (py * (height - 120)) // spec["height"]
        draw.ellipse((x - 6, y - 6, x + 6, y + 6), fill=(128, 49, 38), outline=(247, 240, 224), width=2)
        lw = draw.textlength(label, font=font(17, True))
        tx = min(max(6, x + 10), width - lw - 10)
        ty = y + 8
        if ty > height - 28:
            ty = y - 24
        draw.rectangle((tx - 2, ty - 1, tx + lw + 3, ty + 16), fill=(247, 240, 224))
        draw.text((tx, ty), label, fill=INK, font=font(17, True))
    image.save(os.path.join(OUT, spec["id"] + ".png"), "PNG", optimize=True)
    print(spec["id"], "ok")

with open(os.path.join(OUT, "specs.json"), "w", encoding="utf-8") as fh:
    json.dump(MAPS, fh, ensure_ascii=False, indent=2)
