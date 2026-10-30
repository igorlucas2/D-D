# Avatar no mundo, classe e catálogo do mestre

Status: **correções de integração aplicadas**.
Data: 30/10/2026.

## 1. Avatar no mundo

O viewer tem controles nativos de personagem. O parent agora usa esses
controles para refletir a ficha:

- classe;
- gênero;
- corte de cabelo;
- cor do cabelo;
- cor da roupa;
- tom de pele.

Não há mais sprite sobreposto nem `hidePlayer`. O personagem interno do viewer
é o mesmo da ficha.

Limite: o nome da classe precisa bater com a opção do viewer. As primeiras
classes estão cobertas.

## 2. Ficha por classe

A ficha deixou de usar sprite apenas de Aprendiz:

- cache local para Aprendiz, Espadachim, Mago, Arqueiro, Noviço, Mercador e
  Gatuno;
- masculino/feminino;
- estilos 1–20;
- fallback para paper doll.

## 3. Efeito de classe

Ao conceder classe:

- banner dourado “IGOR agora é Mago”;
- avatar do mundo é sincronizado;
- ficha passa a usar o sprite da classe.

## 4. Catálogo do mestre

- catálogo Ragnarok carrega os primeiros 20 itens sem precisar digitar;
- busca continua com 2+ letras;
- botão **Entregar item** funciona;
- bloco Ragnarok priorizado no painel;
- teste: 21 opções (placeholder + 20) e mensagem “Item entregue”.

## 5. Teste visual

- `frontend/test-results/world-native-sync.png`
- `frontend/test-results/ficha-mago-class.png`
- `frontend/test-results/master-catalog-fixed.png`

## 6. Limites

- classes avançadas podem ter nomes diferentes no viewer;
- cores de equipamento ainda não são compostas;
- item concedido no teste foi removido;
- token/posição no servidor continua separado do visual do viewer.
