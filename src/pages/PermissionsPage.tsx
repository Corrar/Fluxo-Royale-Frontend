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
  Eye, Plus, Pencil, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// --- TIPAGEM ---
type PermissionCategory = "Geral" | "Gestão" | "Movimentação" | "Relatórios" | "Administração";
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

// Configuração visual e ordem estrita das ações para alinhamento em colunas
const ACTION_TYPES: ActionType[] = ["view", "add", "edit", "delete"];

const ACTION_MAP = {
  view: { label: "Ver", icon: Eye, color: "text-blue-400", bg: "data-[state=checked]:bg-blue-600" },
  add: { label: "Criar", icon: Plus, color: "text-emerald-400", bg: "data-[state=checked]:bg-emerald-600" },
  edit: { label: "Editar", icon: Pencil, color: "text-amber-400", bg: "data-[state=checked]:bg-amber-600" },
  delete: { label: "Excluir", icon: Trash2, color: "text-red-400", bg: "data-[state=checked]:bg-red-600" }
};

// --- CONFIGURAÇÃO DE DADOS ---
const AVAILABLE_PAGES: PermissionItem[] = [
  { key: "dashboard", label: "Dashboard / Tarefas", category: "Geral", description: "Visão geral e métricas", actions: ["view"] },
  { key: "tarefas_eletrica", label: "Quadro Elétrica", category: "Geral", description: "Acesso ao quadro", actions: ["view", "add", "edit", "delete"] },
  { key: "avisos", label: "Avisos (Quadro)", category: "Geral", description: "Mural de recados", actions: ["view", "add", "delete"] },
  { key: "produtos", label: "Produtos (Catálogo)", category: "Gestão", description: "Cadastro de catálogo", actions: ["view", "add", "edit", "delete"] },
  { key: "estoque", label: "Estoque (Físico)", category: "Gestão", description: "Ajuste manual (Inventário)", actions: ["view", "edit"] },
  { key: "consultar", label: "Consulta Estoque", category: "Gestão", description: "Verificação de saldos", actions: ["view"] },
  { key: "valores", label: "Valores Financeiros", category: "Gestão", description: "Ver/Editar Custo e Venda", actions: ["view", "edit"] },
  { key: "solicitacoes", label: "Gestão Solicitações", category: "Movimentação", description: "Aprovar pedidos", actions: ["view", "edit", "delete"] },
  { key: "minhas_solicitacoes", label: "Meus Pedidos", category: "Movimentação", description: "Criar próprios pedidos", actions: ["view", "add", "delete"] },
  { key: "separacoes", label: "Separações", category: "Movimentação", description: "Fila do almoxarifado", actions: ["view", "edit"] },
  { key: "relatorios", label: "Relatórios BI", category: "Relatórios", description: "Gráficos gerenciais", actions: ["view"] },
  { key: "clientes", label: "Clientes e OPs", category: "Administração", description: "Cadastros base", actions: ["view", "add", "edit", "delete"] },
  { key: "usuarios", label: "Usuários", category: "Administração", description: "Gestão de acessos", actions: ["view", "add", "edit", "delete"] },
  { key: "permissoes", label: "Matriz Permissões", category: "Administração", description: "Esta tela de segurança", actions: ["view", "edit"] },
];

const ROLES = [
  "admin", "gerente", "almoxarife", "compras", "setor", 
  "escritorio", "financeiro", "chefe", "assistente_tecnico",
  "engenharia", "prototipo", "desenvolvimento"  
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
      const rolePromises = ROLES.map(role => 
        api.post("/admin/permissions/roles", { role, permissions: rolePermissions[role] || [] })
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
    ROLES.forEach(role => grouped[role] = []);
    users.forEach(user => { if (grouped[user.role]) grouped[user.role].push(user); });
    return grouped;
  }, [users]);

  const filteredRoles = ROLES.filter(role => 
    role.includes(searchTerm.toLowerCase()) || 
    (usersByRole[role] || []).some(u => u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // =======================================================================
  // COMPONENTE DE MATRIZ AGRUPADA (REUTILIZÁVEL)
  // =======================================================================
  const PermissionsMatrix = ({ targetId, isUser, perms, parentPerms = [] }: { targetId: string, isUser: boolean, perms: string[], parentPerms?: string[] }) => {
    // Agrupa as páginas pelas suas categorias lógicas
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
            
            {/* CABEÇALHO DA CATEGORIA */}
            <div className="bg-white/5 px-5 py-3 border-b border-white/5 flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-400" />
              <h4 className="text-sm font-bold text-white uppercase tracking-widest">{category}</h4>
            </div>

            {/* LINHAS DA MATRIZ */}
            <div className="p-2 space-y-1">
              {pages.map(page => (
                <div key={page.key} className="flex flex-col xl:flex-row xl:items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors gap-4">
                  
                  {/* Info do Módulo */}
                  <div className="flex flex-col min-w-[220px]">
                    <span className="text-sm font-bold text-slate-200">{page.label}</span>
                    <span className="text-[11px] text-slate-500">{page.description}</span>
                  </div>

                  {/* Ações Alinhadas em Grid Estrito (Tabela) */}
                  <div className="grid grid-cols-4 gap-2 md:gap-8 w-full xl:w-auto">
                    {ACTION_TYPES.map(action => {
                      // Se a página não suporta esta ação, renderiza um espaço vazio para manter o alinhamento
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
            Controle granular agrupado por módulos.
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
            {hasChanges ? "Salvar Matriz" : "Salvo"}
          </Button>
        </div>
      </div>

      {/* BUSCA */}
      <div className="relative shrink-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
        <Input placeholder="Buscar setor ou usuário..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-12 h-14 rounded-2xl bg-[#0f172a]/60 border-white/10 text-white" />
      </div>

      {/* ACORDEÃO PRINCIPAL */}
      <Card className="flex-1 border border-white/5 shadow-2xl bg-[#0f172a]/60 backdrop-blur-xl rounded-3xl overflow-hidden min-h-0">
        <ScrollArea className="h-full p-4 lg:p-6">
          {loading ? (
             <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl bg-white/5" />)}</div>
          ) : (
            <Accordion type="multiple" className="space-y-4 pb-20">
              {filteredRoles.map(role => {
                const roleUsers = usersByRole[role] || [];
                const rPerms = rolePermissions[role] || [];
                
                if (roleUsers.length === 0 && role !== 'admin') return null;

                return (
                  <AccordionItem key={role} value={role} className="border rounded-2xl bg-black/20 border-white/10 overflow-hidden shadow-sm">
                    
                    {/* GATILHO SETOR */}
                    <AccordionTrigger className="px-6 py-5 hover:no-underline hover:bg-white/5">
                      <div className="flex items-center gap-4 text-left">
                        <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                          <Shield className="h-6 w-6"/>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-xl text-white capitalize">{role.replace('_', ' ')}</span>
                          <span className="text-sm text-slate-400">{roleUsers.length} membro(s) vinculados</span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    
                    <AccordionContent className="px-4 lg:px-8 pb-8 pt-4 border-t border-white/5">
                      
                      {/* 1. PERMISSÕES GLOBAIS DO SETOR */}
                      <div className="mb-8 p-6 rounded-2xl bg-white/5 border border-white/10">
                        <h3 className="text-sm font-black text-blue-400 mb-6 uppercase tracking-widest flex items-center gap-2">
                           Regras Padrão do Setor
                        </h3>
                        {/* Invoca a Matriz Reutilizável para o Setor */}
                        <PermissionsMatrix targetId={role} isUser={false} perms={rPerms} />
                      </div>

                      {/* 2. EXCEÇÕES POR USUÁRIO */}
                      {roleUsers.length > 0 && (
                        <div>
                          <h3 className="text-sm font-black text-emerald-400 mb-4 uppercase tracking-widest flex items-center gap-2 mt-10">
                            <UserCog className="h-5 w-5"/> Exceções por Membro
                          </h3>
                          <Accordion type="single" collapsible className="space-y-3">
                            {roleUsers.map(user => {
                              const uPerms = userPermissions[user.id] || [];
                              return (
                                <AccordionItem key={user.id} value={user.id} className="border border-white/10 rounded-xl bg-black/20">
                                  <AccordionTrigger className="px-5 py-4 hover:no-underline">
                                    <div className="flex items-center gap-3">
                                      <span className="text-slate-200 font-bold text-base">{user.name || user.email}</span>
                                      {uPerms.length > 0 && (
                                        <Badge variant="outline" className="text-emerald-400 bg-emerald-500/10 px-3 py-1">
                                          +{uPerms.length} regras extra
                                        </Badge>
                                      )}
                                    </div>
                                  </AccordionTrigger>
                                  <AccordionContent className="px-5 pb-6 pt-4 border-t border-white/5 bg-black/40">
                                    {/* Invoca a Matriz Reutilizável para o Utilizador Individual */}
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
                )
              })}
            </Accordion>
          )}
        </ScrollArea>
      </Card>
    </div>
  );
}
