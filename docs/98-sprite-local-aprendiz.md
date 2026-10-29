# M1.1 — Sprite local do Aprendiz

Status: **prévia real em cache local**.
Data: 29/10/2026.

## 1. O que mudou

- a ficha deixou de usar apenas o paper doll CSS;
- Aprendiz agora usa sprite Ragnarok real;
- sprites ficam em `frontend/public/ragassets/characters/`;
- o paper doll CSS permanece como fallback quando o asset falta.

## 2. Assets

Cache atual:

```text
novice-male-1.png ... novice-male-20.png
novice-female-1.png ... novice-female-20.png
```

- 40 arquivos;
- 208x210;
- frame idle;
- transparência;
- servidos same-origin.

Os arquivos são ignorados pelo Git (assets oficiais). Em uma instalação nova, sem
o cache, a ficha cai no paper doll CSS.

## 3. UI

- sprite no painel esquerdo da ficha;
- `gender` escolhe male/female;
- `hairStyle` escolhe 1–20;
- escala pixelada;
- classes diferentes de Aprendiz usam o paper doll até terem cache.

## 4. Limites

- **hairColor** e **clothesColor** ainda não são aplicados no sprite;
- sprite é estático (frame idle);
- não há equipamento composto no sprite;
- classes além de Aprendiz não têm cache;
- assets não entram no CI;
- renderer de paleta/equipamento é a próxima etapa.

## 5. Próximo

1. aplicar paleta de cabelo/roupa;
2. compor equipamento;
3. cache por classe;
4. animação idle;
5. remover dependência do gerador externo no build local.
