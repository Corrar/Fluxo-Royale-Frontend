import { useState, useEffect, useMemo } from "react";
import { api } from "@/services/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Lock, Save, RefreshCw, ShieldAlert, Search, Layers, 
  LayoutDashboard, Truck, Settings, FileText, Undo2, Info
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// --- TIPAGEM ---
type PermissionCategory = "Geral" | "Gestão" | "Movimentação" | "Relatórios" | "Administração";

interface PermissionItem {
  key: string;
  label: string;
  category: PermissionCategory;
  description?: string;
}

// --- CONFIGURAÇÃO DE DADOS ---
const AVAILABLE_PAGES: PermissionItem[] = [
  // Geral
  { key: "dashboard", label: "Dashboard / Tarefas", category: "Geral", description: "Visão geral, métricas e Quadro de Tarefas" },
  { key: "avisos", label: "Avisos (Quadro)", category: "Geral", description: "Mural de recados e alertas (Kanban)" },
  { key: "calculadora", label: "Calculadora", category: "Geral", description: "Ferramenta de cálculo de materiais" },
  { key: "calculo_minimo", label: "Calc. Mínimo", category: "Geral", description: "Sugestão de compra baseada em histórico" },

  // Gestão
  { key: "produtos", label: "Produtos (Catálogo)", category: "Gestão", description: "Cadastro e edição de catálogo" },
  { key: "estoque", label: "Estoque (Físico)", category: "Gestão", description: "Ajuste manual de quantidade (Inventário)" },
  
  // --- NÍVEIS DE CONSULTA ---
  { key: "consultar", label: "Consulta Estoque (Acesso)", category: "Gestão", description: "Permite ENTRAR na página de consulta (Vê Qtd)" },
  { key: "stock_view_financial", label: "Consulta: Ver Valores", category: "Gestão", description: "Adiciona colunas de Custo e Venda na consulta" },
  { key: "stock_view_edit", label: "Consulta: Editar Preços", category: "Gestão", description: "Permite alterar Custo e Venda na consulta" },

  // Movimentação
  { key: "solicitacoes", label: "Gestão Solicitações", category: "Movimentação", description: "Aprovar e gerenciar pedidos de setores" },
  { key: "minhas_solicitacoes", label: "Meus Pedidos", category: "Movimentação", description: "Criar e ver próprios pedidos (Essencial para Setor)" },
  { key: "separacoes", label: "Separações", category: "Movimentação", description: "Fila de separação de almoxarifado" },
  { key: "confronto_viagem", label: "Confronto de Viagem", category: "Movimentação", description: "Auditoria de retorno de materiais (Técnico/Almoxarife)" },

  // Relatórios
  { key: "estoque_critico", label: "Estoque Crítico", category: "Relatórios", description: "Relatório de compras e reposição" },
  { key: "relatorios", label: "Relatórios BI", category: "Relatórios", description: "Gráficos gerenciais e analíticos" },

  // Admin
  { key: "usuarios", label: "Usuários", category: "Administração", description: "Cadastro de logins e senhas" },
  { key: "logs", label: "Auditoria", category: "Administração", description: "Log de segurança e rastreio" },
  { key: "permissoes", label: "Permissões", category: "Administração", description: "Gerenciamento de acesso (esta tela)" },
];

// --- LISTA DE CARGOS ATUALIZADA ---
const ROLES = [
  "admin", 
  "gerente",           // <--- ADICIONADO AQUI
  "almoxarife", 
  "compras", 
  "setor", 
  "auxiliar", 
  "chefe", 
  "assistente_tecnico",
  "engenharia",      
  "prototipo",       
  "desenvolvimento"  
];

const CATEGORY_ICONS: Record<PermissionCategory, any> = {
  "Geral": LayoutDashboard,
  "Gestão": Layers,
  "Movimentação": Truck,
  "Relatórios": FileText,
  "Administração": Settings
};

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [originalPermissions, setOriginalPermissions] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const hasChanges = useMemo(() => {
    return JSON.stringify(permissions) !== JSON.stringify(originalPermissions);
  }, [permissions, originalPermissions]);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/permissions");
      setPermissions(res.data);
      setOriginalPermissions(res.data);
    } catch (error) {
      toast.error("Erro ao carregar permissões.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const togglePermission = (role: string, pageKey: string) => {
    setPermissions((prev) => {
      const rolePermissions = prev[role] || [];
      const hasPermission = rolePermissions.includes(pageKey);
      let newRolePermissions;
      
      if (hasPermission) {
        newRolePermissions = rolePermissions.filter((p) => p !== pageKey);
      } else {
        newRolePermissions = [...rolePermissions, pageKey];
      }

      return { ...prev, [role]: newRolePermissions };
    });
  };

  const handleUndo = () => {
    setPermissions(originalPermissions);
    toast.info("Alterações descartadas.");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const promises = ROLES.map(role => 
        api.post("/admin/permissions", {
          role,
          permissions: permissions[role] || [],
        })
      );

      await Promise.all(promises);
      setOriginalPermissions(permissions);
      toast.success("Permissões atualizadas com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar permissões.");
    } finally {
      setSaving(false);
    }
  };

  const filteredAndGroupedPermissions = useMemo(() => {
    const filtered = AVAILABLE_PAGES.filter(p => 
      p.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const grouped: Record<string, PermissionItem[]> = {};
    filtered.forEach(item => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });

    return grouped;
  }, [searchTerm]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b pb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-slate-800 dark:text-slate-100">
              <Lock className="h-8 w-8 text-blue-600" />
              Controle de Acesso
            </h1>
            <p className="text-muted-foreground mt-1">
              Defina o que cada cargo pode acessar no sistema.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-center">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Filtrar..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto">
              {hasChanges && (
                <Button variant="ghost" onClick={handleUndo} disabled={saving} className="text-muted-foreground hover:text-red-500">
                  <Undo2 className="h-4 w-4 mr-2" /> Desfazer
                </Button>
              )}
              
              <Button onClick={handleSave} disabled={!hasChanges || saving || loading} className={`min-w-[140px] transition-all ${hasChanges ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {saving ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                ) : (
                  <><Save className="h-4 w-4 mr-2" /> {hasChanges ? "Salvar Alterações" : "Salvo"}</>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* MATRIZ */}
        <div className="border rounded-xl bg-card shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-100/50 dark:bg-slate-900/50">
                <TableRow>
                  <TableHead className="w-[350px] min-w-[300px] sticky left-0 bg-slate-100/95 dark:bg-slate-900/95 z-20 backdrop-blur border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    Funcionalidade
                  </TableHead>
                  {ROLES.map((role) => (
                    <TableHead key={role} className="text-center min-w-[100px] py-4">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span className={`capitalize font-bold text-xs lg:text-sm ${role === 'gerente' ? 'text-orange-600' : 'text-foreground'}`}>
                          {role.replace('_', ' ')}
                        </span>
                        <Badge variant="secondary" className="text-[10px] font-normal px-1.5 h-4 opacity-70">
                          {(permissions[role] || []).length}
                        </Badge>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              
              <TableBody>
                {loading ? (
                   Array.from({ length: 8 }).map((_, i) => (
                     <TableRow key={i}>
                       <TableCell><Skeleton className="h-6 w-full" /></TableCell>
                       {ROLES.map(r => <TableCell key={r}><Skeleton className="h-6 w-6 mx-auto rounded-md" /></TableCell>)}
                     </TableRow>
                   ))
                ) : (
                  Object.entries(filteredAndGroupedPermissions).map(([category, items]) => {
                    const CatIcon = CATEGORY_ICONS[category as PermissionCategory] || Layers;
                    
                    return (
                      <>
                        <TableRow className="bg-slate-50/80 dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                          <TableCell colSpan={ROLES.length + 1} className="py-3 pl-4 border-l-4 border-l-blue-500">
                            <div className="flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-400">
                              <CatIcon className="h-4 w-4" />
                              {category.toUpperCase()}
                            </div>
                          </TableCell>
                        </TableRow>

                        {items.map((page) => (
                          <TableRow key={page.key} className="hover:bg-muted/40 transition-colors group">
                            <TableCell className="font-medium text-sm sticky left-0 bg-card z-10 border-r group-hover:bg-muted/40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                              <div className="flex flex-col pl-2 py-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-foreground/90">{page.label}</span>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Info className="h-3 w-3 text-muted-foreground/50 hover:text-blue-500 transition-colors" />
                                    </TooltipTrigger>
                                    <TooltipContent><p>{page.description}</p></TooltipContent>
                                  </Tooltip>
                                </div>
                                <span className="text-[10px] text-muted-foreground font-mono mt-0.5">{page.key}</span>
                              </div>
                            </TableCell>

                            {ROLES.map((role) => {
                              const isChecked = (permissions[role] || []).includes(page.key);
                              
                              // TRAVA DE SEGURANÇA: Admin não pode remover seu próprio acesso a permissões
                              const isCriticalForAdmin = role === 'admin' && ['permissoes', 'usuarios', 'logs'].includes(page.key);
                              const isDisabled = isCriticalForAdmin;

                              return (
                                <TableCell key={`${role}-${page.key}`} className="text-center p-0">
                                  <div 
                                    className={`flex justify-center items-center h-16 w-full cursor-pointer transition-colors ${isChecked ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''} ${!isDisabled && 'hover:bg-muted/60'}`}
                                    onClick={() => !isDisabled && togglePermission(role, page.key)}
                                  >
                                    {isDisabled ? (
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <ShieldAlert className="h-5 w-5 text-amber-500/50" />
                                        </TooltipTrigger>
                                        <TooltipContent><p>Obrigatório para Admin</p></TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      <Checkbox 
                                        checked={isChecked}
                                        onCheckedChange={() => togglePermission(role, page.key)}
                                        className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 h-5 w-5 border-2 border-muted-foreground/30"
                                      />
                                    )}
                                  </div>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}