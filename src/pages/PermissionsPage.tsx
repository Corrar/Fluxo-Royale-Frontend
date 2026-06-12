// src/pages/PermissionsPage.tsx

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { 
  Save, RefreshCw, Search, Layers,
  UserCog, Shield, Users, Lock,
  Eye, Plus, Pencil, Trash2, Building2
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// --- TIPAGEM ---
type PermissionCategory = "Geral" | "Gestão" | "Movimentação" | "Produção" | "Relatórios" | "Administração";
type ActionType = "view" | "add" | "edit" | "delete";

interface PermissionItem {
  key: string;
  label: string;
  category: PermissionCategory;
  description?: string;
  actions: ActionType[];
}

interface User {
  id: string;
  email: string;
  role: string;
  name?: string;
}

// Configuração visual das ações
const ACTION_TYPES: ActionType[] = ["view", "add", "edit", "delete"];

const ACTION_MAP = {
  view: { label: "Ver", icon: Eye, color: "text-blue-400", bg: "data-[state=checked]:bg-blue-600" },
  add: { label: "Criar", icon: Plus, color: "text-emerald-400", bg: "data-[state=checked]:bg-emerald-600" },
  edit: { label: "Editar", icon: Pencil, color: "text-amber-400", bg: "data-[state=checked]:bg-amber-600" },
  delete: { label: "Excluir", icon: Trash2, color: "text-red-400", bg: "data-[state=checked]:bg-red-600" }
};

// --- CONFIGURAÇÃO DE DADOS (PÁGINAS) ---
const AVAILABLE_PAGES: PermissionItem[] = [
  { key: "dashboard", label: "Dashboard / Tarefas", category: "Geral", description: "Visão geral e métricas", actions: ["view"] },
  { key: "tarefas_eletrica", label: "Quadro Elétrica", category: "Geral", description: "Acesso ao quadro", actions: ["view", "add", "edit", "delete"] },
  { key: "avisos", label: "Avisos (Quadro)", category: "Geral", description: "Mural de recados", actions: ["view", "add", "delete"] },
  { key: "produtos", label: "Produtos (Catálogo)", category: "Gestão", description: "Cadastro de catálogo", actions: ["view", "add", "edit", "delete"] },
  { key: "entradas", label: "Entradas de Material", category: "Gestão", description: "Novos, Devoluções e Reaproveitados", actions: ["view", "add"] },
  { key: "saidas", label: "Saídas de Material", category: "Gestão", description: "Retirada manual para setores", actions: ["view", "add"] },
  { key: "estoque", label: "Estoque (Físico)", category: "Gestão", description: "Ajuste manual (Inventário)", actions: ["view", "edit"] },
  { key: "consultar", label: "Consulta Estoque", category: "Gestão", description: "Verificação de saldos", actions: ["view"] },
  { key: "valores", label: "Valores Financeiros", category: "Gestão", description: "Ver/Editar Custo e Venda", actions: ["view", "edit"] },
  { key: "solicitacoes", label: "Gestão Solicitações", category: "Movimentação", description: "Aprovar pedidos", actions: ["view", "edit", "delete"] },
  { key: "minhas_solicitacoes", label: "Meus Pedidos", category: "Movimentação", description: "Criar próprios pedidos", actions: ["view", "add", "delete"] },
  { key: "separacoes", label: "Separações", category: "Movimentação", description: "Fila do almoxarifado", actions: ["view", "add", "edit", "delete"] },
  { key: "producao_3d", label: "Módulo Produção 3D", category: "Produção", description: "Acesso à Fábrica 3D", actions: ["view", "add", "edit", "delete"] },
  { key: "solicitar_3d", label: "Solicitar Peças 3D", category: "Produção", description: "Vitrine para setores pedirem peças", actions: ["view", "add"] },
  { key: "relatorios", label: "Relatórios BI", category: "Relatórios", description: "Gráficos gerenciais", actions: ["view"] },
  { key: "clientes", label: "Clientes e OPs", category: "Administração", description: "Cadastros base", actions: ["view", "add", "edit", "delete"] },
  { key: "usuarios", label: "Usuários", category: "Administração", description: "Gestão de acessos", actions: ["view", "add", "edit", "delete"] },
  { key: "permissoes", label: "Matriz Permissões", category: "Administração", description: "Esta tela de segurança", actions: ["view", "edit"] },
];

// --- NOVA ESTRUTURA GLOBAL E DETALHADA DE DEPARTAMENTOS ---
const BASE_DEPARTMENTS = [
  {
    id: "usinagem",
    name: "Setor: Usinagem",
    roles: [
      { id: "usinagem_lider", label: "Líder de Usinagem" },
      { id: "usinagem_operador", label: "Operador de Usinagem" }
    ]
  },
  {
    id: "lavadora",
    name: "Setor: Lavadora",
    roles: [
      { id: "lavadora_lider", label: "Líder de Lavadora" },
      { id: "lavadora_operador", label: "Operador de Lavadora" }
    ]
  },
  {
    id: "flow",
    name: "Setor: Flow",
    roles: [
      { id: "flow_lider", label: "Líder de Flow" },
      { id: "flow_operador", label: "Operador de Flow" }
    ]
  },
  {
    id: "eletrica_setor",
    name: "Setor: Elétrica",
    roles: [
      { id: "eletrica_lider", label: "Líder de Elétrica" },
      { id: "eletrica_operador", label: "Operador de Elétrica" }
    ]
  },
  {
    id: "esteira",
    name: "Setor: Esteira",
    roles: [
      { id: "esteira_lider", label: "Líder de Esteira" },
      { id: "esteira_operador", label: "Operador de Esteira" }
    ]
  },
  {
    id: "ferro",
    name: "Setor: Ferro",
    roles: [
      { id: "Ferro", label: "Ferro (Geral/Antigo)" },
      { id: "ferro_lider", label: "Líder de Ferro" },
      { id: "ferro_operador", label: "Operador de Ferro" }
    ]
  },
  {
    id: "obras",
    name: "Setor: Obras",
    roles: [
      { id: "obras", label: "Obras (Geral/Antigo)" },
      { id: "obras_lider", label: "Líder de Obras" },
      { id: "obras_operador", label: "Operador de Obras" }
    ]
  },
  {
    id: "administracao",
    name: "Administração e Gerência",
    roles: [
      { id: "admin", label: "Administrador Global" },
      { id: "gerente", label: "Gerente" },
      { id: "escritorio", label: "Escritório" },
      { id: "financeiro", label: "Financeiro" },
      { id: "chefe", label: "Chefe" }
    ]
  },
  {
    id: "almoxarifado",
    name: "Logística e Almoxarifado",
    roles: [
      { id: "almoxarife", label: "Almoxarife" },
      { id: "compras", label: "Compras" }
    ]
  },
  {
    id: "engenharia",
    name: "Engenharia e Projetos",
    roles: [
      { id: "engenharia", label: "Engenharia" },
      { id: "prototipo", label: "Protótipo" },
      { id: "desenvolvimento", label: "Desenvolvimento" },
      { id: "assistente_tecnico", label: "Assistente Técnico" }
    ]
  },
  {
    id: "legado",
    name: "Outros / Em Transição",
    roles: [
      { id: "setor", label: "Operacional (Antigo/Genérico)" }
    ]
  }
];

export default function PermissionsPage() {
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [originalRolePermissions, setOriginalRolePermissions] = useState<Record<string, string[]>>({});
  const [userPermissions, setUserPermissions] = useState<Record<string, string[]>>({});
  const [originalUserPermissions, setOriginalUserPermissions] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["users-list"],
    queryFn: async () => (await api.get("/users")).data,
  });

  // SISTEMA INTELIGENTE: Cria uma aba para cargos antigos que não estejam listados acima, 
  // garantindo que NUNCA um utilizador desaparece desta página.
  const processedDepartments = useMemo(() => {
    const deps = [...BASE_DEPARTMENTS];
    const allKnownRoles = deps.flatMap(d => d.roles.map(r => r.id));
    const unknownRoles = Array.from(new Set(users.filter(u => !allKnownRoles.includes(u.role)).map(u => u.role)));
    
    if (unknownRoles.length > 0) {
      deps.push({
        id: "desconhecidos",
        name: "Cargos Não Mapeados (Legado)",
        roles: unknownRoles.map(role => ({ id: role, label: `Cargo: ${role}` }))
      });
    }
    return deps;
  }, [users]);

  const hasChanges = useMemo(() => {
    return JSON.stringify(rolePermissions) !== JSON.stringify(originalRolePermissions) || 
           JSON.stringify(userPermissions) !== JSON.stringify(originalUserPermissions);
  }, [rolePermissions, originalRolePermissions, userPermissions, originalUserPermissions]);

  const fetchAllPermissions = async () => {
    try {
      setLoading(true);
      const [resRoles, resUsers] = await Promise.all([
        api.get("/admin/permissions/roles").catch(() => ({ data: {} })), 
        api.get("/admin/permissions/users").catch(() => ({ data: {} }))
      ]);
      setRolePermissions(resRoles.data || {});
      setOriginalRolePermissions(resRoles.data || {});
      setUserPermissions(resUsers.data || {});
      setOriginalUserPermissions(resUsers.data || {});
    } catch (error) {
      toast.error("Erro ao carregar permissões.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAllPermissions(); }, []);

  const togglePerm = (targetId: string, pageKey: string, action: string, isUser: boolean) => {
    const combinedKey = `${pageKey}:${action}`;
    const setter = isUser ? setUserPermissions : setRolePermissions;

    setter((prev) => {
      const perms = prev[targetId] || [];
      const newPerms = perms.includes(combinedKey) 
        ? perms.filter(p => p !== combinedKey) 
        : [...perms, combinedKey];
      return { ...prev, [targetId]: newPerms };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Usar a lista dinâmica para garantir que tudo salva
      const allRoleIds = processedDepartments.flatMap(d => d.roles.map(r => r.id));
      
      const rolePromises = allRoleIds.map(roleId => 
        api.post("/admin/permissions/roles", { role: roleId, permissions: rolePermissions[roleId] || [] })
      );
      
      const userPromises = Object.keys(userPermissions).map(userId => 
        api.post(`/admin/permissions/users`, { userId, permissions: userPermissions[userId] || [] })
      );

      await Promise.all([...rolePromises, ...userPromises]);
      setOriginalRolePermissions(rolePermissions);
      setOriginalUserPermissions(userPermissions);
      toast.success("Matriz salva com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar matriz de segurança.");
    } finally {
      setSaving(false);
    }
  };

  const usersByRole = useMemo(() => {
    const grouped: Record<string, User[]> = {};
    const allRoleIds = processedDepartments.flatMap(d => d.roles.map(r => r.id));
    allRoleIds.forEach(roleId => grouped[roleId] = []);
    users.forEach(user => { 
      if (grouped[user.role]) {
        grouped[user.role].push(user); 
      }
    });
    return grouped;
  }, [users, processedDepartments]);

  // =======================================================================
  // COMPONENTE DE MATRIZ AGRUPADA
  // =======================================================================
  const PermissionsMatrix = ({ targetId, isUser, perms, parentPerms = [] }: { targetId: string, isUser: boolean, perms: string[], parentPerms?: string[] }) => {
    const groupedPages = useMemo(() => {
      const groups: Record<string, PermissionItem[]> = {};
      AVAILABLE_PAGES.forEach(page => {
        if (!groups[page.category]) groups[page.category] = [];
        groups[page.category].push(page);
      });
      return groups;
    }, []);

    return (
      <div className="space-y-6">
        {Object.entries(groupedPages).map(([category, pages]) => (
          <div key={category} className="bg-black/20 rounded-2xl border border-white/10 overflow-hidden shadow-inner">
            <div className="bg-white/5 px-5 py-3 border-b border-white/5 flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-400" />
              <h4 className="text-sm font-bold text-white uppercase tracking-widest">{category}</h4>
            </div>
            <div className="p-2 space-y-1">
              {pages.map(page => (
                <div key={page.key} className="flex flex-col xl:flex-row xl:items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors gap-4">
                  <div className="flex flex-col min-w-[220px]">
                    <span className="text-sm font-bold text-slate-200">{page.label}</span>
                    <span className="text-[11px] text-slate-500">{page.description}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 md:gap-8 w-full xl:w-auto">
                    {ACTION_TYPES.map(action => {
                      if (!page.actions.includes(action)) {
                        return (
                          <div key={action} className="min-w-[60px] md:min-w-[80px] flex flex-col items-center justify-center opacity-20">
                            <span className="text-[10px]">-</span>
                          </div>
                        );
                      }
                      const combinedKey = `${page.key}:${action}`;
                      const isGranted = perms.includes(combinedKey);
                      const isInherited = isUser && parentPerms.includes(combinedKey);
                      const ActionIcon = ACTION_MAP[action].icon;

                      return (
                        <div key={combinedKey} className="flex flex-col items-center gap-2 min-w-[60px] md:min-w-[80px]">
                          <div className="flex items-center gap-1.5">
                            <ActionIcon className={cn("h-3.5 w-3.5", ACTION_MAP[action].color)} />
                            <span className="text-[10px] uppercase font-bold text-slate-400 hidden md:block">
                              {ACTION_MAP[action].label}
                            </span>
                          </div>
                          <Switch 
                            checked={isGranted || isInherited}
                            disabled={isInherited}
                            onCheckedChange={() => togglePerm(targetId, page.key, action, isUser)}
                            className={cn(
                              "scale-90",
                              isInherited ? "data-[state=checked]:bg-slate-600 opacity-50 cursor-not-allowed" : ACTION_MAP[action].bg
                            )}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-32 lg:h-[calc(100vh-6rem)] lg:pb-0 px-2 lg:px-6">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 mt-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 text-white">
            <Lock className="h-6 w-6 text-yellow-400" /> Matriz de Permissões
          </h1>
          <p className="text-sm text-slate-400 mt-1 hidden md:block">
            Controle granular agrupado por setores e classes.
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {hasChanges && (
            <Button variant="ghost" onClick={() => { setRolePermissions(originalRolePermissions); setUserPermissions(originalUserPermissions); }} className="text-red-400 hover:bg-red-900/20 rounded-xl h-10">
              Desfazer
            </Button>
          )}
          <Button onClick={handleSave} disabled={!hasChanges || saving} className={cn("flex-1 md:flex-none h-10 rounded-xl font-bold shadow-lg", hasChanges ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-700 text-slate-400')}>
            {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {hasChanges ? "Salvar Matrizes" : "Salvo"}
          </Button>
        </div>
      </div>

      {/* BUSCA */}
      <div className="relative shrink-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
        <Input placeholder="Buscar por setor ou cargo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-12 h-14 rounded-2xl bg-[#0f172a]/60 border-white/10 text-white" />
      </div>

      {/* ACORDEÃO PRINCIPAL: DEPARTAMENTOS DINÂMICOS */}
      <Card className="flex-1 border border-white/5 shadow-2xl bg-[#0f172a]/60 backdrop-blur-xl rounded-3xl overflow-hidden min-h-0">
        <ScrollArea className="h-full p-4 lg:p-6">
          {loading ? (
             <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl bg-white/5" />)}</div>
          ) : (
            <Accordion type="multiple" className="space-y-4 pb-20">
              {processedDepartments.map(dept => {
                
                const matchesSearch = dept.name.toLowerCase().includes(searchTerm.toLowerCase());
                const totalUsersInDept = dept.roles.reduce((total, role) => total + (usersByRole[role.id]?.length || 0), 0);
                
                if (!matchesSearch && searchTerm !== '') return null;
                // Esconde departamentos onde ainda não existe ninguem, exceto nos setores base
                if (totalUsersInDept === 0 && dept.id === 'desconhecidos') return null;

                return (
                  <AccordionItem key={dept.id} value={dept.id} className="border rounded-2xl bg-black/20 border-white/10 overflow-hidden shadow-sm">
                    
                    <AccordionTrigger className="px-6 py-5 hover:no-underline hover:bg-white/5">
                      <div className="flex items-center gap-4 text-left">
                        <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                          <Building2 className="h-6 w-6"/>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-xl text-white">{dept.name}</span>
                          <span className={cn("text-sm", totalUsersInDept > 0 ? "text-emerald-400" : "text-slate-500")}>
                            {totalUsersInDept} membro(s) no setor
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    
                    <AccordionContent className="px-4 lg:px-8 pb-8 pt-4 border-t border-white/5">
                      <Accordion type="multiple" className="space-y-4">
                        {dept.roles.map(role => {
                          const roleUsers = usersByRole[role.id] || [];
                          const rPerms = rolePermissions[role.id] || [];

                          return (
                            <AccordionItem key={role.id} value={role.id} className="border rounded-xl bg-white/5 border-white/10 overflow-hidden">
                              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/10">
                                <div className="flex items-center gap-3">
                                  <Shield className={cn("h-5 w-5", roleUsers.length > 0 ? "text-emerald-400" : "text-slate-600")}/>
                                  <span className="font-bold text-lg text-slate-200">{role.label}</span>
                                  {roleUsers.length > 0 && (
                                    <Badge variant="secondary" className="ml-2 bg-slate-800 text-slate-300">
                                      {roleUsers.length} membro(s)
                                    </Badge>
                                  )}
                                </div>
                              </AccordionTrigger>
                              
                              <AccordionContent className="px-4 pb-6 pt-4 border-t border-white/10 bg-black/30">
                                {/* 1. PERMISSÕES BASE DA CLASSE/CARGO */}
                                <div className="mb-8 p-4 rounded-xl bg-black/40 border border-white/5">
                                  <h3 className="text-sm font-black text-blue-400 mb-6 uppercase tracking-widest flex items-center gap-2">
                                    Permissões Globais da Classe: {role.label}
                                  </h3>
                                  <PermissionsMatrix targetId={role.id} isUser={false} perms={rPerms} />
                                </div>

                                {/* 2. EXCEÇÕES INDIVIDUAIS (Membros com esta Classe) */}
                                {roleUsers.length > 0 && (
                                  <div>
                                    <h3 className="text-sm font-black text-emerald-400 mb-4 uppercase tracking-widest flex items-center gap-2 mt-8">
                                      <UserCog className="h-5 w-5"/> Exceções Exclusivas
                                    </h3>
                                    <Accordion type="single" collapsible className="space-y-3">
                                      {roleUsers.map(user => {
                                        const uPerms = userPermissions[user.id] || [];
                                        return (
                                          <AccordionItem key={user.id} value={user.id} className="border border-white/10 rounded-xl bg-black/40">
                                            <AccordionTrigger className="px-5 py-4 hover:no-underline">
                                              <div className="flex items-center gap-3">
                                                <span className="text-slate-200 font-bold text-base">{user.name || user.email}</span>
                                                {uPerms.length > 0 && (
                                                  <Badge variant="outline" className="text-emerald-400 bg-emerald-500/10 px-3 py-1">
                                                    +{uPerms.length} regalia(s)
                                                  </Badge>
                                                )}
                                              </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="px-5 pb-6 pt-4 border-t border-white/5 bg-black/60">
                                              <PermissionsMatrix targetId={user.id} isUser={true} perms={uPerms} parentPerms={rPerms} />
                                            </AccordionContent>
                                          </AccordionItem>
                                        )
                                      })}
                                    </Accordion>
                                  </div>
                                )}
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          )}
        </ScrollArea>
      </Card>
    </div>
  );
}
