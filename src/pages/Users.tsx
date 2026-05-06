import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { formatDistanceToNow, differenceInMinutes, format } from "date-fns"; 
import { ptBR } from "date-fns/locale";
import { 
  Trash2, UserPlus, Clock, KeyRound, Shield, Circle, User as UserIcon, 
  MoreVertical, Fingerprint, Building2, Search, Users as UsersIcon, Activity,
  Copy, Ban, CheckCircle2, Eye, EyeOff
} from "lucide-react"; 
import { useAuth } from "@/contexts/AuthContext";

// Configuração de cores Premium com Efeito Glow no Dark Mode
const roleStyles: Record<string, string> = {
  admin: "bg-red-100/50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  gerente: "bg-orange-100/50 text-orange-700 border-orange-200 hover:bg-orange-100 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20",
  almoxarife: "bg-blue-100/50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  setor: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/20",
  compras: "bg-purple-100/50 text-purple-700 border-purple-200 hover:bg-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20",
  escritorio: "bg-emerald-100/50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20", 
  financeiro: "bg-teal-100/50 text-teal-700 border-teal-200 hover:bg-teal-100 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20",
  chefe: "bg-amber-100/50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  assistente_tecnico: "bg-cyan-100/50 text-cyan-700 border-cyan-200 hover:bg-cyan-100 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20",
  engenharia: "bg-indigo-100/50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20",
  prototipo: "bg-pink-100/50 text-pink-700 border-pink-200 hover:bg-pink-100 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-500/20",
  desenvolvimento: "bg-violet-100/50 text-violet-700 border-violet-200 hover:bg-violet-100 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20",
  Ferro: "bg-zinc-100/50 text-zinc-700 border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-500/10 dark:text-zinc-400 dark:border-zinc-500/20",
  obras: "bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400", 
};

const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "gerente", label: "Gerente" },
  { value: "almoxarife", label: "Almoxarife" },
  { value: "compras", label: "Compras" },
  { value: "setor", label: "Operacional" }, 
  { value: "Ferro", label: "Ferro" }, 
  { value: "obras", label: "Obras" }, 
  { value: "escritorio", label: "Escritório" }, 
  { value: "financeiro", label: "Financeiro" },
  { value: "chefe", label: "Chefe" },
  { value: "assistente_tecnico", label: "Técnico" },
  { value: "engenharia", label: "Engenharia" },
  { value: "prototipo", label: "Protótipo" },
  { value: "desenvolvimento", label: "Desenvolvimento" },
];

const SECTOR_OPTIONS = ["Lavadora", "Flow", "Elétrica", "Esteira", "Usinagem", "Ferro", "Obras"]; 

export default function Users() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // Estado para mostrar/ocultar senha
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "setor", sector: "" });
  const [searchTerm, setSearchTerm] = useState("");
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string, name: string } | null>(null);
  
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<{ id: string, name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/users")).data,
    staleTime: 60000, 
  });

  // Mutações
  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const emailFormatado = `${data.email.trim()}@fluxoroyale.local`;
      const setorFinal = data.role === "setor" ? data.sector : "Geral";
      await api.post("/auth/register", { ...data, email: emailFormatado, sector: setorFinal });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Utilizador criado com sucesso!", { icon: <CheckCircle2 className="text-emerald-500" /> });
      setIsCreateOpen(false);
      setNewUser({ name: "", email: "", password: "", role: "setor", sector: "" });
      setShowPassword(false);
    },
    onError: (error: any) => toast.error(error.response?.data?.error || "Erro ao criar utilizador"),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => await api.put(`/users/${id}/role`, { role }),
    onSuccess: () => { 
        queryClient.invalidateQueries({ queryKey: ["users"] }); 
        toast.success("Função atualizada com sucesso!"); 
    },
    onError: () => toast.error("Erro ao atualizar função"),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => await api.delete(`/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Membro excluído permanentemente!");
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: () => toast.error("Erro ao excluir membro"),
  });

  // --- AQUI ESTÁ A CORREÇÃO ---
  // A rota de reset password agora bate em /users/:id/reset-password
  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!userToReset || !newPassword) return;
      await api.post(`/users/${userToReset.id}/reset-password`, { newPassword });
    },
    onSuccess: () => {
      toast.success(`Credenciais de ${userToReset?.name} redefinidas!`);
      setResetDialogOpen(false);
      setNewPassword("");
      setUserToReset(null);
    },
    onError: () => toast.error("Erro ao redefinir senha"),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => 
      await api.put(`/users/${id}/status`, { is_active }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      if (variables.is_active) {
        toast.success("Acesso reativado com sucesso!");
      } else {
        toast.error("Conta suspensa instantaneamente!");
      }
    },
    onError: () => toast.error("Erro ao alterar o estado da conta."),
  });

  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) setNewUser({ ...newUser, email: value });
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.password) return toast.warning("Preencha os campos obrigatórios");
    if (newUser.email.length < 3) return toast.warning("O ID deve ter no mínimo 3 números");
    if (newUser.role === "setor" && !newUser.sector) return toast.warning("Selecione o Setor Operacional");
    createUserMutation.mutate(newUser);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("ID copiado para a área de transferência!");
  };

  // Processamento de Dados (Busca e Estatísticas)
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter((u: any) => 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.sector && u.sector.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [users, searchTerm]);

  const stats = useMemo(() => {
    if (!users) return { total: 0, online: 0, hours: 0 };
    const now = new Date();
    // Só conta online se a pessoa não estiver suspensa
    const online = users.filter((u: any) => u.is_active !== false && u.last_active && differenceInMinutes(now, new Date(u.last_active)) < 5).length;
    const hours = Math.floor(users.reduce((acc: number, u: any) => acc + (u.total_minutes || 0), 0) / 60);
    return { total: users.length, online, hours };
  }, [users]);

  // Helpers Visuais
  const formatTime = (minutes: number) => {
    if (!minutes && minutes !== 0) return "0h";
    const h = Math.floor(minutes / 60);
    return `${h}h`;
  };

  const displayId = (email: string) => email ? email.split('@')[0] : "-";

  const isUserOnline = (dateString: string | null, is_active: boolean) => {
    if (is_active === false) return false; 
    if (!dateString) return false;
    return Math.abs(differenceInMinutes(new Date(), new Date(dateString))) < 5;
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-20 max-w-[1600px] mx-auto px-4 md:px-8 pt-4 md:pt-8">
      
      {/* HEADER & QUICK STATS */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 border-b border-border/20 pb-6">
        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-2xl dark:bg-primary/20">
              <UsersIcon className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            </div>
            Gestão de Equipa
          </h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base font-medium max-w-xl">
            Controle acessos, defina permissões e acompanhe a atividade dos colaboradores em tempo real.
          </p>
        </div>
        
        {/* --- MODAL DE CRIAÇÃO PREMIUM NUBANK STYLE --- */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="h-12 md:h-14 px-6 rounded-2xl font-bold text-base shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 w-full xl:w-auto bg-primary hover:bg-primary/90">
              <UserPlus className="h-5 w-5 mr-2" /> Novo Colaborador
            </Button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-[480px] p-0 rounded-[2rem] bg-card/95 backdrop-blur-2xl border-border/50 shadow-2xl overflow-hidden">
            
            {/* Cabeçalho do Modal Decorado */}
            <div className="px-6 pt-8 pb-6 bg-gradient-to-b from-primary/5 dark:from-primary/10 to-transparent flex flex-col items-center text-center">
               <div className="h-20 w-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4 ring-8 ring-background/50 shadow-sm">
                  <UserPlus className="h-8 w-8" />
               </div>
               <DialogTitle className="text-2xl font-extrabold tracking-tight text-foreground">Registar Acesso</DialogTitle>
               <DialogDescription className="text-[13px] font-medium mt-2 text-muted-foreground max-w-[80%] mx-auto">
                 Defina as credenciais e as permissões de acesso para o novo membro da plataforma.
               </DialogDescription>
            </div>

            {/* Formulário de Criação */}
            <form onSubmit={handleSubmitCreate} className="px-6 pb-8 space-y-6">
              
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Nome Completo</Label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input 
                    className="pl-12 h-14 rounded-xl bg-muted/40 border-border/50 focus-visible:ring-primary/50 shadow-inner font-medium text-base transition-all" 
                    required 
                    value={newUser.name} 
                    onChange={e => setNewUser({...newUser, name: e.target.value})} 
                    placeholder="Ex: Ana Souza" 
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">ID (Numérico)</Label>
                  <div className="relative">
                    <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      className="pl-10 h-14 rounded-xl bg-muted/40 border-border/50 focus-visible:ring-primary/50 shadow-inner font-bold text-base transition-all" 
                      required 
                      value={newUser.email} 
                      onChange={handleIdChange} 
                      placeholder="101" 
                      maxLength={10} 
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground ml-1 mt-1 font-medium">Mín. 3 números</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Senha Segura</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      className="pl-10 pr-12 h-14 rounded-xl bg-muted/40 border-border/50 focus-visible:ring-primary/50 shadow-inner font-mono text-lg tracking-widest transition-all" 
                      required 
                      type={showPassword ? "text" : "password"} 
                      value={newUser.password} 
                      onChange={e => setNewUser({...newUser, password: e.target.value})} 
                      placeholder="••••••" 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Função / Cargo</Label>
                <Select value={newUser.role} onValueChange={v => setNewUser(prev => ({ ...prev, role: v, sector: v === "setor" ? "" : "Geral" }))}>
                  <SelectTrigger className="h-14 rounded-xl bg-muted/40 border-border/50 focus:ring-primary/50 shadow-inner font-medium text-base transition-all">
                    <SelectValue placeholder="Selecione o cargo principal..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-2xl border-border/50 bg-card/95 backdrop-blur-xl">
                    <div className="max-h-[220px] overflow-y-auto custom-scrollbar p-1">
                      {ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value} className="py-3 cursor-pointer rounded-lg font-medium">
                          {role.label}
                        </SelectItem>
                      ))}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              {newUser.role === "setor" && (
                <div className="space-y-1.5 animate-in slide-in-from-top-4 fade-in duration-300">
                  <Label className="text-primary font-bold text-xs uppercase tracking-wider ml-1">Setor Operacional</Label>
                  <Select value={newUser.sector} onValueChange={v => setNewUser({...newUser, sector: v})}>
                    <SelectTrigger className="h-14 rounded-xl bg-primary/5 border-primary/20 focus:ring-primary/50 shadow-inner font-bold text-base text-primary transition-all">
                        <SelectValue placeholder="Onde o colaborador vai atuar?" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-2xl border-border/50 bg-card/95 backdrop-blur-xl">
                      <div className="p-1">
                        {SECTOR_OPTIONS.map((sector) => (
                          <SelectItem key={sector} value={sector} className="py-3 cursor-pointer rounded-lg font-medium">{sector}</SelectItem>
                        ))}
                      </div>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="pt-4 flex flex-col gap-3">
                <Button type="submit" disabled={createUserMutation.isPending} className="w-full h-14 rounded-xl font-extrabold text-[15px] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                    {createUserMutation.isPending ? "A Registar..." : "Confirmar e Registar"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)} className="w-full h-12 rounded-xl text-muted-foreground hover:text-foreground font-semibold">
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* DASHBOARD CARDS & SEARCH */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-center">
         <div className="xl:col-span-8 flex flex-wrap gap-4">
            <Card className="rounded-[1.5rem] border-border/30 bg-card/40 backdrop-blur-md shadow-sm flex-1 min-w-[140px] hover:bg-card/60 transition-colors">
              <CardContent className="p-4 md:p-5 flex items-center gap-4">
                <div className="p-3.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl">
                  <UsersIcon className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <div>
                  <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-wider">Total de Membros</p>
                  <p className="text-2xl md:text-3xl font-black">{stats.total}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="rounded-[1.5rem] border-border/30 bg-card/40 backdrop-blur-md shadow-sm flex-1 min-w-[140px] hover:bg-card/60 transition-colors">
              <CardContent className="p-4 md:p-5 flex items-center gap-4">
                <div className="relative p-3.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                  <span className="absolute top-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-background rounded-full animate-pulse"></span>
                  <Activity className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <div>
                  <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-wider">Online Agora</p>
                  <p className="text-2xl md:text-3xl font-black">{stats.online}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem] border-border/30 bg-card/40 backdrop-blur-md shadow-sm flex-1 min-w-[140px] hidden sm:block hover:bg-card/60 transition-colors">
              <CardContent className="p-4 md:p-5 flex items-center gap-4">
                <div className="p-3.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-2xl">
                  <Clock className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <div>
                  <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-wider">Horas Úteis Totais</p>
                  <p className="text-2xl md:text-3xl font-black">{stats.hours}h</p>
                </div>
              </CardContent>
            </Card>
         </div>

         <div className="xl:col-span-4 relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome, id ou cargo..." 
              className="pl-12 h-14 md:h-16 rounded-[1.5rem] bg-card/50 backdrop-blur-md border-border/30 shadow-sm focus-visible:ring-primary/30 text-base font-medium w-full transition-all hover:bg-card/80"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
         </div>
      </div>

      {/* GRID DE CARTÕES (LAYOUT NUBANK/PICPAY) */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
           {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="h-[280px] rounded-[2rem] bg-muted/20 animate-pulse border-border/10"></Card>
           ))}
        </div>
      ) : filteredUsers?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-card/30 rounded-[2rem] border border-border/30 border-dashed mt-8">
            <Search className="h-16 w-16 mb-4 opacity-20" />
            <p className="font-bold text-xl">Nenhum membro encontrado.</p>
            <p className="text-sm opacity-70 mt-1">Verifique os termos da sua pesquisa.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6 mt-8">
          {filteredUsers?.map((user: any) => {
             const isOnline = isUserOnline(user.last_active, user.is_active);
             
             return (
               <Card key={user.id} className={`relative overflow-hidden group hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-primary/5 transition-all duration-300 bg-card/40 backdrop-blur-xl rounded-[2rem] ${user.is_active === false ? 'opacity-80 border-red-500/30' : 'border-border/30 hover:border-primary/30'}`}>
                  {/* Glow Line Top (Vermelho se suspenso, Primary se ativo) */}
                  <div className={`absolute top-0 left-0 w-full h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${user.is_active === false ? 'bg-gradient-to-r from-transparent via-red-500/50 to-transparent' : 'bg-gradient-to-r from-transparent via-primary/50 to-transparent'}`} />
                  
                  <CardContent className="p-6">
                    {/* Header do Cartão */}
                    <div className="flex justify-between items-start mb-5">
                       <div className="relative flex-shrink-0">
                          <Avatar className={`h-14 w-14 md:h-16 md:w-16 border-2 border-background shadow-md ${user.is_active === false ? 'grayscale opacity-50' : ''}`}>
                            <AvatarFallback className={`${user.role === 'admin' ? 'bg-gradient-to-br from-red-500 to-red-700 text-white' : 'bg-gradient-to-br from-primary/80 to-primary text-white'} font-black text-lg md:text-xl`}>
                              {user.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {isOnline && (
                             <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-background rounded-full shadow-sm"></span>
                          )}
                       </div>

                       {/* Menu de Ações (Dropdown) */}
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-10 w-10 p-0 rounded-full hover:bg-muted/80 focus-visible:ring-0 text-muted-foreground hover:text-foreground transition-colors">
                              <span className="sr-only">Opções</span>
                              <MoreVertical className="h-5 w-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[200px] rounded-2xl shadow-2xl p-1.5 border-border/50 bg-card/95 backdrop-blur-xl">
                            <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-widest font-black px-2 py-1.5">Ações do Membro</DropdownMenuLabel>
                            
                            <DropdownMenuItem onClick={() => copyToClipboard(displayId(user.email))} className="cursor-pointer py-3 rounded-xl font-medium focus:bg-muted transition-colors">
                              <Copy className="mr-3 h-4 w-4 text-slate-500" /> Copiar ID
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem onClick={() => { setUserToReset(user); setResetDialogOpen(true); }} className="cursor-pointer py-3 rounded-xl font-medium focus:bg-amber-500/10 focus:text-amber-600 dark:focus:text-amber-400 transition-colors">
                              <KeyRound className="mr-3 h-4 w-4 text-amber-500" /> Redefinir Senha
                            </DropdownMenuItem>

                            {/* --- BOTÃO DE SUSPENDER/REATIVAR --- */}
                            {user.id !== currentUser?.id && (
                              <DropdownMenuItem 
                                onClick={() => toggleStatusMutation.mutate({ id: user.id, is_active: user.is_active === false ? true : false })} 
                                className={`cursor-pointer py-3 rounded-xl font-medium transition-colors ${user.is_active === false ? 'focus:bg-emerald-500/10 focus:text-emerald-600 dark:focus:text-emerald-400' : 'focus:bg-orange-500/10 focus:text-orange-600 dark:focus:text-orange-400'}`}
                              >
                                {user.is_active === false ? (
                                  <><CheckCircle2 className="mr-3 h-4 w-4 text-emerald-500" /> Reativar Acesso</>
                                ) : (
                                  <><Ban className="mr-3 h-4 w-4 text-orange-500" /> Suspender Acesso</>
                                )}
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator className="bg-border/30 my-1" />
                            
                            <DropdownMenuItem 
                              onClick={() => { setUserToDelete(user); setDeleteDialogOpen(true); }}
                              className="text-red-600 dark:text-red-400 focus:text-red-700 dark:focus:text-red-300 focus:bg-red-500/10 cursor-pointer py-3 rounded-xl font-bold transition-colors"
                              disabled={user.id === currentUser?.id}
                            >
                              <Trash2 className="mr-3 h-4 w-4" /> Excluir Conta
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Info do Usuário */}
                    <div className="mb-5">
                       <h3 className="text-lg md:text-xl font-extrabold text-foreground truncate flex items-center gap-2">
                          {user.name}
                          {user.role === 'admin' && <Shield className="h-4 w-4 text-red-500 fill-red-500/20 shrink-0" />}
                          
                          {/* ETIQUETA DE SUSPENSO */}
                          {user.is_active === false && (
                            <span className="ml-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border border-red-200 dark:border-red-900/50">
                              Suspenso
                            </span>
                          )}
                       </h3>
                       <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-mono mt-0.5">
                          <Fingerprint className="h-3.5 w-3.5 opacity-70" />
                          {displayId(user.email)}
                       </div>
                    </div>

                    {/* Badges e Edição Rápida */}
                    <div className="flex flex-wrap gap-2 mb-6">
                       <div className="relative group/role">
                         <Select 
                            value={user.role} 
                            onValueChange={(value) => updateRoleMutation.mutate({ id: user.id, role: value })} 
                            disabled={user.id === currentUser?.id || user.is_active === false}
                          >
                            <SelectTrigger className={`h-8 text-[11px] font-black uppercase tracking-widest border border-border/20 shadow-sm w-auto gap-2 px-3 rounded-lg transition-all ${roleStyles[user.role] || "bg-gray-100 text-gray-700"} focus:ring-0 disabled:opacity-50`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl shadow-2xl border-border/50 bg-card/95 backdrop-blur-xl">
                               <div className="p-1">
                                 <p className="text-[10px] text-muted-foreground px-2 py-2 font-black uppercase tracking-widest">Mudar Função</p>
                                 {ROLES.map((role) => (
                                   <SelectItem key={role.value} value={role.value} className="text-xs font-bold cursor-pointer rounded-lg py-2">
                                     {role.label}
                                   </SelectItem>
                                 ))}
                               </div>
                            </SelectContent>
                          </Select>
                       </div>

                       <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-foreground/70 bg-muted/50 px-3 py-1.5 rounded-lg border border-border/30">
                          <Building2 className="h-3.5 w-3.5 opacity-60" />
                          <span className="truncate max-w-[100px]">{user.sector || "Geral"}</span>
                       </div>
                    </div>

                    {/* Footer do Cartão (Estatísticas) */}
                    <div className="pt-4 border-t border-border/30 flex items-center justify-between text-xs">
                       <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tempo Útil</span>
                          <span className="font-mono font-semibold text-foreground flex items-center gap-1.5">
                             <Clock className="h-3.5 w-3.5 text-primary/70" />
                             {formatTime(user.total_minutes)}
                          </span>
                       </div>
                       <div className="flex flex-col gap-1 items-end text-right">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Última Ação</span>
                          {isOnline ? (
                             <span className="font-semibold text-emerald-600 dark:text-emerald-400">Agora</span>
                          ) : (
                             <span className="font-medium text-foreground">{user.last_active ? formatDistanceToNow(new Date(user.last_active), { addSuffix: true, locale: ptBR }) : 'Nunca'}</span>
                          )}
                       </div>
                    </div>
                  </CardContent>
               </Card>
             );
          })}
        </div>
      )}

      {/* MODALS REUTILIZADOS (Reset e Excluir) mantendo o design Premium */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-[2rem] p-6 md:p-8 bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold text-amber-600 dark:text-amber-500 flex items-center gap-3">
              <KeyRound className="h-6 w-6" /> Redefinir Senha
            </DialogTitle>
            <DialogDescription className="text-base mt-2 text-muted-foreground">
              Gerar nova senha temporária para <strong>{userToReset?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Nova Senha de Acesso</Label>
              <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    className="pl-12 h-14 rounded-xl font-mono text-xl tracking-widest bg-background/50 border-border/50 shadow-inner focus-visible:ring-amber-500/30"
                  />
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-between gap-3 pt-2">
            <Button variant="ghost" onClick={() => setResetDialogOpen(false)} className="h-12 rounded-xl hover:bg-muted">Cancelar</Button>
            <Button onClick={() => resetPasswordMutation.mutate()} disabled={!newPassword || resetPasswordMutation.isPending} className="h-12 rounded-xl font-bold px-6 bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20">
              {resetPasswordMutation.isPending ? "A Guardar..." : "Confirmar Nova Senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-[440px] rounded-[2rem] p-6 md:p-8 bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl">
          <AlertDialogHeader>
            <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
               <Ban className="h-8 w-8 text-red-500" />
            </div>
            <AlertDialogTitle className="text-2xl font-extrabold text-center text-foreground">Remover Colaborador?</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-base mt-3 text-muted-foreground">
              Esta ação é <strong className="text-red-500 dark:text-red-400">irreversível</strong>. O utilizador <strong>{userToDelete?.name}</strong> perderá o acesso ao sistema instantaneamente. O histórico de atividades passadas será mantido para auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 flex-col sm:flex-row gap-3">
            <AlertDialogCancel className="mt-0 h-12 rounded-xl font-bold w-full bg-muted/50 hover:bg-muted border-0">Manter Acesso</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)} 
              className="bg-red-600 hover:bg-red-700 text-white h-12 rounded-xl font-bold shadow-lg shadow-red-600/20 w-full m-0"
            >
              Sim, Excluir Conta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
