"""Generate original schematic SVG maps from the lore atlas; no dependencies."""

from html import escape
import json
from pathlib import Path
import random

ROOT = Path(__file__).resolve().parent
ATLAS = json.loads((ROOT.parent / "atlas.json").read_text(encoding="utf-8"))
INK = "#273f40"
PAPER = "#eee4cb"
GOLD = "#a37239"


class Map:
    def __init__(self, key, subtitle):
        self.data = next(m for m in ATLAS["maps"] if m["id"] == key)
        self.w, self.h = self.data["width"] * 50, self.data["height"] * 50
        self.parts = [f'''<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}" role="img" aria-labelledby="title desc">
<title id="title">{escape(self.data['name'])}</title>
<desc id="desc">Mapa original esquemático do Pacto dos Três Sinos. {escape(subtitle)}</desc>
<defs>
  <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#273f40" stroke-opacity=".10" stroke-width="1"/></pattern>
  <pattern id="stone" width="50" height="50" patternUnits="userSpaceOnUse"><rect width="50" height="50" fill="#dfd7c2"/><path d="M0 0H50V50H0Z" fill="none" stroke="#b8b09b" stroke-width="1"/></pattern>
</defs>
<rect width="100%" height="100%" fill="{PAPER}"/>
''']
        self.subtitle = subtitle

    def add(self, source):
        self.parts.append(source)

    def path(self, d, fill="none", stroke=INK, width=2, extra=""):
        self.add(f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round" {extra}/>')

    def rect(self, x, y, w, h, fill, stroke="none", sw=1, extra=""):
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')

    def circle(self, x, y, r, fill, stroke="none", sw=1):
        self.add(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')

    def text(self, x, y, label, size=18, color=INK, anchor="start", weight="normal", halo=False, serif=False):
        effect = f'stroke="{PAPER}" stroke-width="6" paint-order="stroke" stroke-linejoin="round"' if halo else ""
        font = "Georgia, serif" if serif else "Arial, sans-serif"
        self.add(f'<text x="{x}" y="{y}" fill="{color}" font-family="{font}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}" {effect}>{escape(label)}</text>')

    def grid(self):
        self.rect(0, 0, self.w, self.h, "url(#grid)")

    def heading(self, title):
        self.text(45, 60, title, 34, weight="bold", serif=True, halo=True)
        self.text(47, 91, self.subtitle, 14, halo=True)
        self.path("M45 108H340", stroke=GOLD, width=2)
        x = self.w - 65
        self.text(x, 42, "N", 16, anchor="middle", weight="bold")
        self.path(f"M{x} 56L{x-11} 90L{x} 82L{x+11} 90Z", fill=INK, width=1)

    def marker(self, point, num, label, dx=28, dy=7, anchor="start"):
        x, y = (point["x"] + .5) * 50, (point["y"] + .5) * 50
        self.circle(x, y, 18, PAPER, INK, 2)
        self.text(x, y + 6, str(num), 17, anchor="middle", weight="bold")
        self.text(x + dx, y + dy, label, 20, anchor=anchor, weight="bold", halo=True)

    def save(self):
        self.parts.append("</svg>\n")
        out = ROOT.parent / self.data["asset"]
        out.write_text("\n".join(self.parts), encoding="utf-8")
        print(out.name)


def tree(m, x, y, scale=1):
    m.path(f"M{x} {y+13*scale}V{y+26*scale}", stroke="#687252", width=2)
    m.path(f"M{x} {y-17*scale}L{x-13*scale} {y+15*scale}H{x+13*scale}Z", fill="#84956a", stroke="#657757", width=1)


def region():
    m = Map("vale", "Marca de Véspera · rotas em minutos de jogo · cartografia esquemática")
    m.path("M130 250Q240 135 420 205T580 350Q600 490 465 590T190 500Q65 370 130 250Z", fill="#d3d8b9", stroke="none")
    m.path("M220 715Q330 620 505 740T625 925Q410 985 230 930T220 715Z", fill="#c3d1bc", stroke="none")
    m.path("M915 130L1060 100L1390 165L1460 390L1260 420L1040 320Z", fill="#ddd0b4", stroke="none")
    rng = random.Random(87)
    for _ in range(55):
        x, y = rng.randint(150, 520), rng.randint(230, 530)
        if (x - 350) ** 2 / 220 ** 2 + (y - 370) ** 2 / 165 ** 2 < 1:
            tree(m, x, y, .8)
    for x, y, h in [(1030,210,62),(1110,195,68),(1200,210,90),(1310,240,100),(1380,320,62),(1220,340,58)]:
        m.path(f"M{x-55} {y+30}L{x} {y-h}L{x+60} {y+30}", fill="#c5b99d", stroke="#918b74", width=2)
        m.path(f"M{x-15} {y-h+27}L{x} {y-h}L{x+18} {y-h+28}", stroke="#f1ead8", width=3)
    river = "M835 -30C670 145 925 245 775 425S815 570 725 675S750 900 660 1030"
    m.path(river, stroke="#9bb9b8", width=52)
    m.path(river, stroke="#bed1cb", width=35)
    for y in [770, 830, 900]:
        for x in [260, 330, 480, 540]:
            m.path(f"M{x} {y}q12 -8 24 0m-12 -4v-14", stroke="#809d8a", width=2)
    points = {p["id"]: p for p in ATLAS["places"] if p["mapId"] == "vale"}
    labels = {("porto","ponte"):(805,550), ("ponte","mata"):(570,350), ("ponte","mina"):(945,350), ("porto","abadia"):(975,650), ("porto","brejo"):(600,745), ("brejo","mata"):(355,600), ("mina","abadia"):(1210,485)}
    for route in ATLAS["routes"]:
        a, b = points[route["from"]], points[route["to"]]
        x1,y1,x2,y2 = (a["x"]+.5)*50,(a["y"]+.5)*50,(b["x"]+.5)*50,(b["y"]+.5)*50
        m.path(f"M{x1} {y1}L{x2} {y2}", stroke=PAPER, width=9)
        m.path(f"M{x1} {y1}L{x2} {y2}", stroke=GOLD, width=3, extra='stroke-dasharray="7 6"')
    m.grid()
    m.path("M740 410L810 440M740 425L803 452", stroke="#7b7158", width=5)
    for route in ATLAS["routes"]:
        x,y = labels[(route["from"],route["to"])]
        m.rect(x-38,y-17,76,27,PAPER,extra='rx="8"')
        m.text(x,y+2,f'{route["minutes"]} min',15,anchor="middle",weight="bold")
    m.marker(points["porto"],1,"Porto das Cinzas",dy=46,dx=0,anchor="middle")
    m.marker(points["ponte"],2,"Ponte Velha",dx=35,dy=10)
    m.marker(points["mata"],3,"Mata do Cervo",dy=-31,dx=0,anchor="middle")
    m.marker(points["mina"],4,"Mina da Vigília",dy=45,dx=5,anchor="middle")
    m.marker(points["abadia"],5,"Abadia do",dy=45,dx=0,anchor="middle")
    m.text(1225,746,"Terceiro Sino",20,anchor="middle",weight="bold",halo=True)
    m.marker(points["brejo"],6,"Brejo das Lanternas",dy=46,dx=0,anchor="middle")
    m.text(870,195,"Rio Lume",20,color="#496e71",serif=True,halo=True)
    m.heading("Vale do Lume")
    m.text(45,953,"O PACTO DOS TRÊS SINOS",14,weight="bold")
    m.text(1455,953,"Rota pontilhada = passagem conhecida · tempos base",15,anchor="end")
    m.save()


def house(m, x, y, w, h, color="#9d7455"):
    m.rect(x+4,y+5,w,h,"#c6b998")
    m.rect(x,y,w,h,color,"#715f4e",2)
    m.path(f"M{x+w/2} {y}V{y+h}",stroke="#cdb798",width=2)
    m.rect(x+w*.64,y+5,9,12,"#5f6260")


def town():
    m = Map("porto", "Vale do Lume · lugares públicos · planta esquemática da vila")
    m.path("M965 -10C930 165 1030 310 1000 475S900 640 900 730S1030 820 990 920H1230V-10Z",fill="#a8c4c1",stroke="none")
    m.path("M965 -10C930 165 1030 310 1000 475S900 640 900 730S1030 820 990 920",stroke="#769b98",width=5)
    # Roads are visual references; movement costs are defined separately.
    for d in ["M0 475H900", "M625 0V775", "M325 475V900", "M425 225H825V475", "M625 475L925 675", "M325 525H625"]:
        m.path(d,stroke="#c7b998",width=32)
        m.path(d,stroke="#e4d5b5",width=26)
    for x,y,w,h in [(115,215,80,70),(230,200,65,110),(100,350,110,70),(275,340,80,65),(490,330,70,75),(700,325,65,80),(725,570,80,65),(150,640,95,80),(420,650,80,75),(540,770,110,70),(700,760,75,65),(95,770,90,65),(810,145,70,85),(700,130,75,70),(180,135,80,40),(780,455,80,70)]:
        house(m,x,y,w,h,color="#ad8d68")
    # Named buildings sit at atlas coordinates.
    house(m,275,495,100,80)
    house(m,380,175,90,95,color="#82927e")
    house(m,775,280,100,90,color="#7f8d83")
    m.circle(625,225,36,"#d6cfb8",INK,3)
    m.circle(625,225,23,"#ab9471",INK,1)
    m.rect(550,420,150,120,"#ded1ac","#b19b72",2)
    for x,y in [(560,430),(650,430),(560,500),(650,500)]:
        m.rect(x,y,38,25,"#9b5e46","#75563f",1)
        m.path(f"M{x+19} {y}V{y+25}",stroke="#dbc5a2",width=4)
    m.rect(860,650,170,50,"#aa8a5b","#786648",3)
    for x in range(870,1030,15):
        m.path(f"M{x} 652V698",stroke="#806c4f",width=1)
    for x,y in [(1060,540),(1040,745)]:
        m.path(f"M{x} {y-35}Q{x-40} {y} {x} {y+35}Q{x+40} {y} {x} {y-35}Z",fill="#8d7654",stroke="#5e6255",width=2)
        m.path(f"M{x-15} {y}H{x+15}",stroke="#d8c8a4",width=3)
    for x,y in [(90,530),(200,570),(500,600),(750,110),(100,130),(440,800),(870,800)]:
        tree(m,x,y,1.2)
    m.grid()
    pts = {p["id"]: p for p in ATLAS["places"] if p["mapId"] == "porto"}
    m.marker(pts["taverna"],1,"Última Brasa",dx=-50,dy=73)
    m.marker(pts["mercado"],2,"Mercado das Cordas",dx=0,dy=99,anchor="middle")
    m.marker(pts["guarda"],3,"Casa da Guarda",dx=0,dy=75,anchor="middle")
    m.marker(pts["capela"],4,"Capela do Junco",dx=-30,dy=77)
    m.marker(pts["cais"],5,"Cais do Lume",dx=-25,dy=70,anchor="middle")
    m.marker(pts["vau"],6,"Torre do Vau",dx=0,dy=64,anchor="middle")
    m.text(1080,450,"Rio",24,color="#416c70",anchor="middle",serif=True)
    m.text(1080,480,"Lume",24,color="#416c70",anchor="middle",serif=True)
    m.heading("Porto das Cinzas")
    m.text(45,863,"O PACTO DOS TRÊS SINOS",14,weight="bold")
    m.text(1155,863,"Pontos numerados = locais de cena · norte para cima",14,anchor="end")
    m.save()


def abbey():
    m = Map("abadia", "Vale do Lume · planta conhecida · 1 célula = 1 unidade de distância do jogo")
    m.rect(60,130,1080,700,"#d6cfba",extra='rx="16"')
    # Corridors first, then room walls. Door openings are explicitly painted below.
    for x,y,w,h in [(250,440,50,120),(440,275,120,50),(840,275,120,50),(675,440,50,120),(490,650,120,50),(250,790,50,110)]:
        m.rect(x,y,w,h,"url(#stone)","#6f7769",8)
    for room in ATLAS["rooms"]:
        m.rect(room["x"]*50,room["y"]*50,room["width"]*50,room["height"]*50,"url(#stone)","#626e62",12)
    # Openings with small doorposts; no locked/secret state is encoded.
    for x,y,vertical in [(275,450,False),(275,550,False),(450,300,True),(550,300,True),(850,300,True),(950,300,True),(700,450,False),(700,550,False),(500,675,True),(600,675,True),(275,800,False)]:
        if vertical:
            m.rect(x-7,y-25,14,50,"#dfd7c2")
            m.path(f"M{x-8} {y-25}h16m-16 50h16",stroke="#987b4e",width=4)
        else:
            m.rect(x-25,y-7,50,14,"#dfd7c2")
            m.path(f"M{x-25} {y-8}v16m50 -16v16",stroke="#987b4e",width=4)
    # Archive shelves, cloister columns, bell platform, workbenches and courtyard well.
    for x in [130,370]:
        m.rect(x,180,45,210,"#a58e64","#716a51",2)
        for y in range(190,390,20):
            m.path(f"M{x+6} {y}h32",stroke="#dac6a0",width=3)
    for x,y in [(590,200),(810,200),(590,400),(810,400)]:
        m.circle(x,y,15,"#b4b59f","#77816f",3)
    m.rect(650,240,100,110,"#b6c4a6","#84967e",2)
    m.circle(1025,350,34,"#b7a06c","#766344",3)
    m.circle(1025,350,19,"none","#766344",2)
    m.path("M1006 350H1044M1025 331V369",stroke="#766344",width=2)
    for x in [645,920]:
        m.rect(x,710,120,42,"#a58e64","#716a51",3)
        m.path(f"M{x+16} 720v23m20 -23v23m20 -23v23",stroke="#6c7365",width=3)
    m.circle(300,695,37,"#b4b69f","#727d6c",4)
    m.circle(300,695,23,"#90aaa5","#727d6c",2)
    m.grid()
    for x,y,code,label in [(300,595,"A1","Pátio"),(275,235,"A2","Arquivo"),(700,195,"A3","Claustro"),(1025,200,"A4","Campanário"),(850,600,"A5","Oficina")]:
        m.text(x,y,code,17,anchor="middle",weight="bold",halo=True)
        m.text(x,y+30,label,18 if code=="A4" else 22,anchor="middle",weight="bold",halo=True)
    m.text(1025,423,"Sino Guarda",15,anchor="middle",halo=True)
    m.text(300,760,"aberto ao céu",14,anchor="middle",halo=True)
    m.heading("Abadia do Terceiro Sino")
    m.text(230,869,"Entrada",16,anchor="end",weight="bold",halo=True)
    m.text(1155,861,"Paredes e passagens: referência visual",14,anchor="end")
    m.text(1155,883,"Encontros e descobertas são dados separados",14,anchor="end")
    m.save()


if __name__ == "__main__":
    region()
    town()
    abbey()
