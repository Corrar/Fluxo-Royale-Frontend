import { useState } from "react";
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
import { formatDistanceToNow, differenceInMinutes } from "date-fns"; 
import { ptBR } from "date-fns/locale";
import { 
  Trash2, UserPlus, Clock, KeyRound, Shield, Circle, User as UserIcon, 
  MoreHorizontal, Fingerprint, Building2
} from "lucide-react"; 
import { useAuth } from "@/contexts/AuthContext";

// Configuração de cores (Tipografia e Backgrounds mais suaves)
const roleStyles: Record<string, string> = {
  admin: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
  gerente: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
  almoxarife: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
  setor: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200",
  compras: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
  auxiliar: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  chefe: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
  assistente_tecnico: "bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100",
  engenharia: "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100",
  prototipo: "bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100",
  desenvolvimento: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100",
  Ferro: "bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100", // <--- NOVO: Cargo Ferro
};

const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "gerente", label: "Gerente" },
  { value: "almoxarife", label: "Almoxarife" },
  { value: "compras", label: "Compras" },
  { value: "setor", label: "Operacional" }, // Usa setor específico
  { value: "Ferro", label: "Ferro" }, // <--- NOVO: Opção de Cargo Ferro
  { value: "auxiliar", label: "Auxiliar" },
  { value: "chefe", label: "Chefe" },
  { value: "assistente_tecnico", label: "Técnico" },
  { value: "engenharia", label: "Engenharia" },
  { value: "prototipo", label: "Protótipo" },
  { value: "desenvolvimento", label: "Desenvolvimento" },
];

const SECTOR_OPTIONS = ["Lavadora", "Flow", "Elétrica", "Esteira", "Usinagem", "Ferro"]; // <--- Adicionado Ferro aqui também

export default function Users() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "setor", sector: "" });
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string, name: string } | null>(null);
  
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<{ id: string, name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/users")).data,
    refetchInterval: 5000, 
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const emailFormatado = `${data.email.trim()}@fluxoroyale.local`;
      const setorFinal = data.role === "setor" ? data.sector : "Geral";
      await api.post("/auth/register", { ...data, email: emailFormatado, sector: setorFinal });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Usuário criado com sucesso!");
      setIsCreateOpen(false);
      setNewUser({ name: "", email: "", password: "", role: "setor", sector: "" });
    },
    onError: (error: any) => toast.error(error.response?.data?.error || "Erro ao criar usuário"),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => await api.put(`/users/${id}/role`, { role }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); toast.success("Função atualizada!"); },
    onError: () => toast.error("Erro ao atualizar função"),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => await api.delete(`/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Usuário excluído!");
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: () => toast.error("Erro ao excluir usuário"),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!userToReset || !newPassword) return;
      await api.post("/admin/reset-password", { userId: userToReset.id, newPassword });
    },
    onSuccess: () => {
      toast.success(`Senha de ${userToReset?.name} alterada!`);
      setResetDialogOpen(false);
      setNewPassword("");
      setUserToReset(null);
    },
    onError: () => toast.error("Erro ao resetar senha"),
  });

  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) setNewUser({ ...newUser, email: value });
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.password) return toast.warning("Preencha os campos obrigatórios");
    if (newUser.email.length < 3) return toast.warning("O ID deve ter no mínimo 3 números");
    if (newUser.role === "setor" && !newUser.sector) return toast.warning("Selecione o Setor");
    createUserMutation.mutate(newUser);
  };

  const formatTime = (minutes: number) => {
    if (!minutes && minutes !== 0) return "0m";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const displayId = (email: string) => email ? email.split('@')[0] : "-";

  const renderLastActive = (dateString: string | null) => {
    if (!dateString) return <span className="text-xs text-muted-foreground flex items-center gap-1"><Circle className="h-2 w-2 fill-muted-foreground/30 text-transparent"/> Offline</span>;
    
    const date = new Date(dateString);
    const now = new Date();
    const isOnline = Math.abs(differenceInMinutes(now, date)) < 2;

    if (isOnline) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Online
        </span>
      );
    }

    return (
      <span className="text-xs text-muted-foreground" title={date.toLocaleString()}>
        {formatDistanceToNow(date, { addSuffix: true, locale: ptBR })}
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* HEADER ELEGANTE */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <UserIcon className="h-6 w-6 text-primary" />
            </div>
            Equipe & Acessos
          </h1>
          <p className="text-muted-foreground mt-2 text-sm max-w-lg">
            Gerencie os membros da equipe, controle permissões de acesso e monitore a produtividade em tempo real.
          </p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 shadow-md transition-all hover:scale-105 active:scale-95">
              <UserPlus className="h-4 w-4 mr-2" /> Novo Membro
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Membro</DialogTitle>
              <DialogDescription>
                Crie um acesso para um novo colaborador.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitCreate} className="space-y-4 mt-2">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Nome Completo</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" required value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="Ex: João Silva" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>ID (Numérico)</Label>
                    <div className="relative">
                      <Fingerprint className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9" required value={newUser.email} onChange={handleIdChange} placeholder="101" maxLength={10} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Senha</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9" required type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder="******" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Função / Cargo</Label>
                  <Select value={newUser.role} onValueChange={v => setNewUser(prev => ({ ...prev, role: v, sector: v === "setor" ? "" : "Geral" }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione a função" /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {newUser.role === "setor" && (
                  <div className="space-y-1 animate-in slide-in-from-top-2 fade-in">
                    <Label className="text-primary">Setor Operacional</Label>
                    <Select value={newUser.sector} onValueChange={v => setNewUser({...newUser, sector: v})}>
                      <SelectTrigger className="border-primary/30 bg-primary/5">
                          <SelectValue placeholder="Selecione o setor..." />
                      </SelectTrigger>
                      <SelectContent>
                        {SECTOR_OPTIONS.map((sector) => (
                          <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createUserMutation.isPending}>
                    {createUserMutation.isPending ? "Criando..." : "Criar Acesso"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* TABELA PRINCIPAL */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-b border-border/60">
                <TableHead className="w-[300px] pl-6 py-4">Colaborador</TableHead>
                <TableHead className="w-[150px]">Função</TableHead>
                <TableHead className="w-[150px]">Setor</TableHead>
                <TableHead className="w-[150px]">Produtividade</TableHead>
                <TableHead className="w-[150px]">Status</TableHead>
                <TableHead className="w-[50px] text-right pr-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={6} className="h-16 text-center text-muted-foreground animate-pulse">Carregando dados...</TableCell></TableRow>
                ))
              ) : users?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Nenhum usuário encontrado</TableCell></TableRow>
              ) : (
                users?.map((user: any) => (
                  <TableRow key={user.id} className="group hover:bg-muted/40 transition-colors border-b border-border/40 last:border-0">
                    
                    {/* COLUNA NOME */}
                    <TableCell className="pl-6 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-border">
                          <AvatarFallback className={`${user.role === 'admin' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'} font-bold text-xs`}>
                            {user.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                            {user.name} 
                            {user.role === 'admin' && <Shield className="h-3 w-3 text-red-500 fill-red-100" />}
                          </span>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Fingerprint className="h-3 w-3" />
                            {displayId(user.email)}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    
                    {/* COLUNA FUNÇÃO (Editável Inline) */}
                    <TableCell>
                      <Select 
                        value={user.role} 
                        onValueChange={(value) => updateRoleMutation.mutate({ id: user.id, role: value })} 
                        disabled={user.id === currentUser?.id}
                      >
                        <SelectTrigger className={`h-7 text-[11px] font-medium border-0 shadow-none w-auto gap-2 px-2.5 rounded-full transition-colors ${roleStyles[user.role] || "bg-gray-100"}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="p-1">
                            <p className="text-xs text-muted-foreground px-2 py-1.5 font-medium">Alterar Função</p>
                            {ROLES.map((role) => (
                              <SelectItem key={role.value} value={role.value} className="text-xs">
                                {role.label}
                              </SelectItem>
                            ))}
                          </div>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* COLUNA SETOR */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5 opacity-50" />
                        {user.sector || "Geral"}
                      </div>
                    </TableCell>
                    
                    {/* COLUNA TEMPO */}
                    <TableCell>
                      <div className="flex items-center gap-2 text-foreground/80 font-medium text-sm">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatTime(user.total_minutes)}
                      </div>
                    </TableCell>
                    
                    {/* COLUNA STATUS */}
                    <TableCell>
                      {renderLastActive(user.last_active)}
                    </TableCell>

                    {/* COLUNA AÇÕES (MENU) */}
                    <TableCell className="text-right pr-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity data-[state=open]:opacity-100">
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px]">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => { setUserToReset(user); setResetDialogOpen(true); }}>
                            <KeyRound className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                            Resetar Senha
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => { setUserToDelete(user); setDeleteDialogOpen(true); }}
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            disabled={user.id === currentUser?.id}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Excluir Conta
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* DIALOG RESET SENHA */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Credenciais</DialogTitle>
            <DialogDescription>
              Crie uma nova senha temporária para <strong>{userToReset?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input 
                type="password" 
                placeholder="••••••" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => resetPasswordMutation.mutate()} disabled={!newPassword || resetPasswordMutation.isPending}>
              {resetPasswordMutation.isPending ? "Salvando..." : "Confirmar Alteração"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG EXCLUIR */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Remover Acesso?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação excluirá permanentemente o usuário <strong>{userToDelete?.name}</strong> e revogará todo o acesso ao sistema. O histórico de movimentações será mantido para auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter Usuário</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)} 
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Sim, Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
