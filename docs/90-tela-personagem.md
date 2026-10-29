# Tela de personagem em tela cheia

Status: **implementada a versão paper doll**.
Data: 29/10/2026.

## 1. O que mudou

- a aba **Ficha** da lateral foi removida;
- `C` abre a tela cheia de personagem;
- `Esc` ou `C` fecham;
- o overlay é renderizado via **portal no `body`**, cobrindo o header do site;
- o mapa continua atrás, desfocado;
- hotbar fixa no rodapé com PV e atalhos `C`/`M`.

## 2. Tela

Cabeçalho:

- nome;
- classe/nível;
- job Ragnarok, quando houver;
- zeny (placeholder);
- fechar.

Corpo:

- paper doll com silhueta, iniciais, PV/SP e equipados;
- navegação: Atributos, Habilidades, Equipamento, Inventário, Missões;
- atributos SRD ou Ragnarok;
- skills Ragnarok ou magias SRD;
- inventário/equipamento;
- missões como placeholder.

## 3. Fonte de dados

- `Character` + `HudCharacter` para a ficha SRD;
- `RagnarokSheet` para ficha Ragnarok, se existir;
- fallback para SRD quando não há ficha Ragnarok.

## 4. Teste

- `C` abriu a tela (`role=dialog`, nome “Tela de personagem”);
- `C` fechou;
- hotbar visível;
- `M` abriu o Console do Mestre;
- screenshot: `frontend/test-results/character-screen-doll.png`.

## 5. Limites

- **paper doll 2D**, não modelo 3D ainda;
- atributos são somente leitura;
- pontos de status não são distribuíveis;
- skills são listadas, mas não aprendidas;
- missões ainda vazias;
- zeny ainda não implementado;
- equipamento Ragnarok só aparece se houver ficha vinculada.

## 6. Próximo passo

1. modelo 3D/GLB no paper doll;
2. pontos de atributo com servidor;
3. árvore de skills com pré-requisitos;
4. loja/Kafra no mundo;
5. diário de missões.
