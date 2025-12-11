import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2, UserPlus, Clock, KeyRound, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// Configuração de cores para as badges de cargo
const roleColors = {
  admin: "bg-red-100 text-red-800 border-red-200",
  almoxarife: "bg-blue-100 text-blue-800 border-blue-200",
  setor: "bg-slate-100 text-slate-800 border-slate-200",
  compras: "bg-purple-100 text-purple-800 border-purple-200",
  auxiliar: "bg-emerald-100 text-emerald-800 border-emerald-200",
  chefe: "bg-amber-100 text-amber-800 border-amber-200",
  assistente_tecnico: "bg-cyan-100 text-cyan-800 border-cyan-200",
};

// Lista de cargos
const ROLES = [
  { value: "setor", label: "Setor (Operacional)" },
  { value: "almoxarife", label: "Almoxarife" },
  { value: "compras", label: "Compras" },
  { value: "admin", label: "Administrador" },
  { value: "auxiliar", label: "Auxiliar (Preços)" },
  { value: "chefe", label: "Chefe" },
  { value: "assistente_tecnico", label: "Assistente Técnico" },
];

// Lista de Setores Específicos
const SECTOR_OPTIONS = ["Lavadora", "Flow", "Elétrica", "Esteira", "Usinagem"];

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

  // 1. LISTAR USUÁRIOS
  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/users")).data,
    refetchInterval: 30000,
  });

  // 2. CRIAR USUÁRIO
  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      // Formata ID numérico para email interno
      const emailFormatado = `${data.email.trim()}@fluxoroyale.local`;
      
      // Define setor padrão se não for cargo de "setor"
      const setorFinal = data.role === "setor" ? data.sector : "Geral";

      await api.post("/auth/register", { 
        ...data, 
        email: emailFormatado,
        sector: setorFinal 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Usuário criado com sucesso!");
      setIsCreateOpen(false);
      setNewUser({ name: "", email: "", password: "", role: "setor", sector: "" });
    },
    onError: (error: any) => toast.error(error.response?.data?.error || "Erro ao criar usuário"),
  });

  // Mutações de Update/Delete/Reset (Mantidas iguais)
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

  // Handlers
  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Permite apenas números
    if (/^\d*$/.test(value)) {
      setNewUser({ ...newUser, email: value });
    }
  };

  const handleRoleChange = (role: string) => {
    setNewUser(prev => ({ 
      ...prev, 
      role, 
      sector: role === "setor" ? "" : "Geral" // Reseta setor se mudar o cargo
    }));
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações
    if (!newUser.name || !newUser.email || !newUser.password) {
        return toast.warning("Preencha os campos obrigatórios");
    }
    if (newUser.email.length < 3) {
        return toast.warning("O ID deve ter no mínimo 3 números");
    }
    if (newUser.role === "setor" && !newUser.sector) {
        return toast.warning("Selecione o Setor");
    }

    createUserMutation.mutate(newUser);
  };

  const formatTime = (minutes: number) => {
    if (!minutes) return "0m";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // Helper para exibir ID limpo (sem @fluxoroyale.local) na tabela
  const displayId = (email: string) => email ? email.split('@')[0] : "-";

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gerenciamento de Usuários</h1>
          <p className="text-muted-foreground">Controle de acesso e produtividade</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <UserPlus className="h-4 w-4 mr-2" /> Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input required value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="Ex: João Silva" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ID (Apenas Números) *</Label>
                  <Input 
                    required 
                    value={newUser.email} 
                    onChange={handleIdChange} 
                    placeholder="Ex: 101" 
                    maxLength={10}
                  />
                  <span className="text-xs text-muted-foreground">Mínimo 3 dígitos</span>
                </div>
                <div className="space-y-2">
                  <Label>Senha *</Label>
                  <Input required type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder="******" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Cargo / Função</Label>
                <Select value={newUser.role} onValueChange={handleRoleChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* CAMPO CONDICIONAL DE SETOR */}
              {newUser.role === "setor" && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-emerald-600 font-semibold">Selecione o Setor *</Label>
                  <Select value={newUser.sector} onValueChange={v => setNewUser({...newUser, sector: v})}>
                    <SelectTrigger className="border-emerald-200 bg-emerald-50/50">
                        <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTOR_OPTIONS.map((sector) => (
                        <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createUserMutation.isPending}>
                    {createUserMutation.isPending ? "Criando..." : "Criar Usuário"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Nome</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Tempo de Uso</TableHead>
              <TableHead>Visto por último</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="text-center h-24">Carregando...</TableCell></TableRow> : 
             users?.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center h-24">Nenhum usuário encontrado</TableCell></TableRow> :
             users?.map((user: any) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {user.name} 
                      {user.role === 'admin' && <Shield className="w-3 h-3 text-red-500" />}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">{displayId(user.email)}</TableCell>
                  <TableCell>{user.sector || "-"}</TableCell>
                  <TableCell>
                    <Select value={user.role} onValueChange={(value) => updateRoleMutation.mutate({ id: user.id, role: value })} disabled={user.id === currentUser?.id}>
                        <SelectTrigger className={`w-[140px] h-8 ${roleColors[user.role as keyof typeof roleColors] || "bg-gray-100"}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((role) => (
                            <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-2 text-blue-600 font-semibold">
                      <Clock className="h-4 w-4" />
                      {formatTime(user.total_minutes)}
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-xs text-muted-foreground">
                    {user.last_active ? formatDistanceToNow(new Date(user.last_active), { addSuffix: true, locale: ptBR }) : "Nunca"}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => { setUserToReset(user); setResetDialogOpen(true); }} title="Resetar Senha">
                        <KeyRound className="h-4 w-4 text-orange-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => { setUserToDelete(user); setDeleteDialogOpen(true); }} disabled={user.id === currentUser?.id}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div>

      {/* DIALOGS DE CONFIRMAÇÃO E RESET (Mantidos) */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Redefinir Senha</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Defina uma nova senha para <strong>{userToReset?.name}</strong>.</p>
            <Input type="password" placeholder="Nova senha" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <Button className="w-full" onClick={() => resetPasswordMutation.mutate()} disabled={!newPassword || resetPasswordMutation.isPending}>
                {resetPasswordMutation.isPending ? "Alterando..." : "Confirmar Alteração"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza? <strong>{userToDelete?.name}</strong> perderá o acesso imediatamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}