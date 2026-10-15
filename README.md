<div align="center">

<img src="public/logo-royale.png" alt="Fluxo Royale" width="96" />

# Fluxo Royale

Sistema de controle de estoque, compras e requisições por setor.

[![Demo](https://img.shields.io/badge/demo-fluxo--royale.vercel.app-22c55e?style=flat-square&logo=vercel)](https://fluxo-royale.vercel.app)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-0F172A?style=flat-square&logo=tailwindcss&logoColor=38BDF8)
[![CI](https://github.com/Corrar/Fluxo-Royale-Frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/Corrar/Fluxo-Royale-Frontend/actions/workflows/ci.yml)

<!-- ![Painel](docs/painel.png) -->

</div>

## ✨ Funcionalidades

| Área | O que tem |
|---|---|
| **Estoque** | Visão geral, entradas, saídas, movimentações, estoque baixo, cálculo de estoque mínimo e produtos arquivados |
| **Requisições** | Pedidos dos setores, "minhas requisições", separações, reposições e devoluções por setor |
| **Produção 3D** | Painel, catálogo, demandas e fila de produção de peças impressas em 3D |
| **Gestão** | Clientes, conciliação de viagens, importação de XML, relatórios com gráficos e exportação em PDF/Excel |
| **Equipe** | Quadros de tarefas (inclusive da elétrica), lembretes, calculadora e busca global |
| **Administração** | Usuários, permissões por tela, auditoria de ações e configurações do sistema |
| **App** | Instalável (PWA) com notificações push |

## 🛠️ Tecnologias

- **React 18 + TypeScript** com **Vite**
- **Tailwind CSS** + **shadcn/ui** (Radix) e animações com **GSAP** / **Framer Motion**
- **TanStack Query**, **React Hook Form** + **Zod**
- **Recharts** (gráficos), **jsPDF** e **SheetJS** (exportação), **dnd-kit** (arrastar e soltar)
- **Socket.IO** para atualizações em tempo real
- API própria: [Fluxo-Royale-Backend](https://github.com/Corrar/Fluxo-Royale-Backend) (Node.js, Express, PostgreSQL)

## 🚀 Como rodar

Pré-requisito: **Node.js 20+** (a mesma versão da CI).

```bash
git clone https://github.com/Corrar/Fluxo-Royale-Frontend.git
cd Fluxo-Royale-Frontend
npm install
echo "VITE_API_URL=http://localhost:3000" > .env   # endereço da API
npm run dev
```

| Script | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | checagem de tipos + build de produção |
| `npm run lint` | ESLint |
| `npm run preview` | serve o build localmente |

## 📁 Estrutura

```
src/
├── pages/         # telas (estoque, requisições, Produção 3D, relatórios…)
├── components/    # layout, sidebar, cards e componentes shadcn/ui (ui/)
├── contexts/      # autenticação e conexão em tempo real (Socket.IO)
├── hooks/         # hooks reutilizáveis
├── services/      # cliente da API (VITE_API_URL)
├── integrations/  # cliente do Supabase
├── lib/ · utils/  # utilitários
└── types/         # tipos TypeScript
public/            # logo, manifest.json e sw.js (PWA e notificações)
```

A cada PR e push na `master`, a CI roda typecheck e build ([`ci.yml`](.github/workflows/ci.yml)).

## 📄 Licença

Todos os direitos reservados.
