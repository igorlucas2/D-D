# Como rodar o Eldoria

## Jeito rápido (Windows)

- **Iniciar Eldoria.cmd** (dois cliques): sobe o backend (porta 3001) e o frontend (porta 3000), abre o site e fica monitorando.
- **Parar Eldoria.cmd**: encerra tudo. Se a janela do monitor estiver aberta, ela também fecha.

Na janela do monitor:

| Tecla | Ação |
| --- | --- |
| A | abrir o site no navegador |
| R | reiniciar backend e frontend |
| L | mostrar as últimas linhas dos logs |
| Q (ou Ctrl+C) | encerrar tudo |

## O que o monitor faz

1. Encerra o que sobrou de execuções anteriores **deste projeto**:
   - outro monitor aberto: pede que ele feche e espera, para os dois não brigarem;
   - servidores do projeto (Nest e Next), inclusive os que ficaram órfãos sem porta.

   Se uma porta estiver com outro programa, avisa e não mexe nele.
2. Prepara o ambiente: instala dependências se faltarem, aplica migrações do banco e gera o cliente Prisma.
3. Sobe os serviços e espera responderem: backend em `/api/health` (testa também o banco) e frontend na página inicial.
4. A cada 10 s confere os dois:
   - se o processo cair, reinicia na hora;
   - se ficar 3 verificações sem responder, reinicia;
   - se precisar reiniciar mais de 5 vezes em 10 minutos, para de tentar, apita e mostra o log. Use R para tentar de novo.
5. O título da janela mostra o estado atual (ex.: `backend ok 12ms | frontend ok 340ms`).

Logs de cada sessão ficam em `logs\<data-hora>\`: `monitor.log` e a saída de cada serviço. Cada reinício ganha um arquivo próprio, e as 10 sessões mais recentes são mantidas.

## Opções

Pelo terminal, na pasta do projeto:

```powershell
.\scripts\eldoria.ps1                      # desenvolvimento (recarrega ao editar)
.\scripts\eldoria.ps1 -Mode prod           # compila e roda em modo produção
.\scripts\eldoria.ps1 -NoBrowser           # não abre o navegador
.\scripts\eldoria.ps1 -CheckInterval 30    # verifica a cada 30 s
.\scripts\eldoria.ps1 -SkipSetup           # pula dependências/migrações
.\scripts\eldoria.ps1 -Stop                # só encerra
```

Os atalhos `.cmd` aceitam as mesmas opções, por exemplo: `"Iniciar Eldoria.cmd" -Mode prod`.

## Acesso de fora (túnel do Cloudflare)

O navegador fala só com o frontend (porta 3000). O Next repassa `/api` e `/socket.io` para o backend em `localhost:3001` (ver `frontend/next.config.ts`). Por isso basta o túnel apontar para **`http://localhost:3000`**; a porta 3001 não precisa ficar exposta.

Para o modo desenvolvimento aceitar o domínio público, ele precisa estar em `frontend/.env.local`:

```
ELDORIA_PUBLIC_HOSTS=eldoria.connectcore.app.br
```

Para mais de um domínio, separe por vírgula. Sem isso, o Next bloqueia os próprios scripts de desenvolvimento para esse domínio: a página abre, mas os botões não funcionam (o login só recarrega a tela).

## Requisitos

- Node.js 20 ou mais recente.
- `backend\.env` com `DATABASE_URL`, `PORT=3001` e um `JWT_SECRET` **obrigatório de pelo menos 32 caracteres** — o servidor não inicia com o valor de exemplo nem sem ele. Gere com: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Trocar o segredo encerra as sessões abertas (todos precisam entrar de novo).
- Opcional: `ANTHROPIC_API_KEY` no `backend\.env` para o **assistente do mestre**. Sem ela, o assistente aparece como indisponível. O custo das chamadas fica na conta dessa chave; cada campanha liga o assistente e define um limite mensal de pedidos.
- `frontend\.env.local` com `NEXT_PUBLIC_API_URL=/api` (mesma origem), `BACKEND_URL=http://localhost:3001` e, se usar túnel, `ELDORIA_PUBLIC_HOSTS`.
- Com túnel, o `backend\.env` também precisa de `ELDORIA_PUBLIC_HOSTS=seu-dominio` (ou `ELDORIA_ALLOWED_ORIGINS=https://seu-dominio`) e `TRUST_PROXY=1`; sem isso o CORS e o Socket.IO recusam a origem pública.
- O backend responde com cabeçalhos de segurança (`helmet`) e o Next envia CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` e `Permissions-Policy`. Payloads JSON são limitados a 1 MB.
