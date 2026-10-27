# Estrutura de Pastas

```
online-rpg/
├── docs/                          # esta documentação
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── dev.db                 # SQLite (gerado, não versionar dados reais)
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── prisma/
│   │   │   ├── prisma.module.ts
│   │   │   └── prisma.service.ts
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── jwt.strategy.ts
│   │   │   └── dto/
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   └── users.service.ts
│   │   ├── characters/
│   │   │   ├── characters.module.ts
│   │   │   ├── characters.controller.ts
│   │   │   ├── characters.service.ts
│   │   │   └── dto/
│   │   ├── dice/
│   │   │   ├── dice.module.ts
│   │   │   ├── dice.controller.ts
│   │   │   └── dice.service.ts
│   │   ├── inventory/        # v1.0
│   │   ├── spells/            # v1.0
│   │   ├── campaigns/         # v1.0
│   │   ├── combat/            # v1.0
│   │   ├── vtt/                # v1.0
│   │   ├── journal/            # v1.0
│   │   ├── library/            # v1.0
│   │   ├── world/               # v1.0
│   │   └── ai-master/           # v1.0
│   ├── test/
│   ├── .env
│   ├── nest-cli.json
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/login/page.tsx
│   │   │   ├── (auth)/register/page.tsx
│   │   │   ├── (app)/dashboard/page.tsx
│   │   │   ├── (app)/characters/page.tsx
│   │   │   ├── (app)/characters/new/page.tsx
│   │   │   ├── (app)/characters/[id]/page.tsx
│   │   │   ├── (app)/dice/page.tsx
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── ui/             # shadcn components
│   │   │   ├── character/
│   │   │   ├── dice/
│   │   │   └── layout/
│   │   ├── lib/
│   │   │   ├── api.ts          # cliente HTTP da API
│   │   │   └── auth.ts
│   │   └── stores/
│   ├── public/
│   ├── tailwind.config.ts
│   └── package.json
├── packages/
│   └── shared/
│       └── src/
│           └── rules/          # cálculo de modificadores, CA, vida, etc.
└── mobile/                       # futuro (React Native/Expo)
```
