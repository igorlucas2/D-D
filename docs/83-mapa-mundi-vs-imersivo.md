# Mapa-múndi x mesa imersiva

Status: **UI não promete mais 3D no mapa-múndi**.
Última atualização: 28/10/2026.

## 1. Causa

Em `/campaigns/:id`, o mapa **Midgard** é a arte do mapa-múndi:

- não tem `liveSlug`;
- o endpoint `?mode=3d` devolve a mesma textura do mundo;
- por isso **Foto 3D** não mudava nada;
- **3D navegável** ficava desabilitado.

A cena 3D real é a mesa imersiva:

```text
/campaigns/:id/immersive
```

Ela carrega Prontera/cidades com o viewer 3D.

## 2. Correção

Para `Midgard`:

- remove os botões 2D/Foto 3D;
- mostra o selo **Mapa-múndi ilustrado**;
- troca o botão desabilitado por **Abrir mesa imersiva**;
- explica que o 3D navegável fica nas cidades e na mesa imersiva.

Para mapas com `liveSlug`:

- **3D navegável** continua abrindo o modal do viewer.

## 3. Evidência

- workspace: `frontend/test-results/world-map-cta.png`;
- mesa imersiva real: `frontend/test-results/diagnose-workspace-immersive.png`;
- iframe do viewer: 1.

## 4. Limites

- o mapa-múndi continua 2D;
- a mesa imersiva abre na primeira cena 3D disponível (Prontera), não no mapa-múndi;
- sem cena 3D do mundo inteiro.

## 5. Próxima fase

- passar o mapa selecionado na URL da mesa imersiva;
- criar cena 3D do mapa-múndi;
- minimapa 3D.
