# Visual Ragnarok no avatar imersivo

Status: **ficha Ragnarok alimenta o avatar 3D**.
Última atualização: 28/10/2026.

## 1. Fonte do visual

Na ficha Ragnarok já existe `appearance`, com o link do construtor. A mesa
imersiva agora busca `/ragnarok/characters` e lista as fichas que têm visual.

No topo do mapa:

```text
Visual SRD
RO · Visual Ragnarok
```

Ao escolher uma ficha Ragnarok:

1. extrai o `?b=` do link;
2. recria a URL `/immersive/index.html?b=...#play/<mapa>`;
3. recarrega o viewer;
4. o avatar passa a usar esse build.

O SRD continua disponível como **Visual SRD**.

## 2. Cadastro do visual

O formulário de ficha Ragnarok ganhou:

```text
Link do visual (opcional)
https://visuais.latam-tools.com.br/?b=...
```

O link é salvo em `RagnarokCharacter.appearance`.

## 3. Teste

- ficha `Visual Ragnarok`, Aprendiz Nv 10;
- `appearance` com build `?b=1.34m...`;
- seletor mostrou **2 opções** (SRD + RO);
- escolha `RO · Visual Ragnarok`;
- avatar mudou para o build azul/branco;
- ficha de teste removida; 0 fichas.

Screenshot: `frontend/test-results/immersive-ro-visual.png`.

## 4. Limites

- o visual não altera atributos da mesa 5e;
- a ficha Ragnarok ainda não é a ficha ativa do combate;
- o seletor só aparece se houver ficha com visual;
- a URL precisa ser do `visuais.latam-tools.com.br`.

## 5. Próxima fase

- escolher ficha Ragnarok como personagem da mesa;
- usar HP/SP/skills Ragnarok no combate próprio;
- editor de visual dentro da ficha;
- árvore de skills.
