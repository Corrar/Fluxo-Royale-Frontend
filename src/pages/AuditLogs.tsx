import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { format } from "date-fns";
import { 
  ShieldCheck, Search, Filter, RefreshCw, Calendar, 
  Download, FileSpreadsheet, FileText, Loader2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; // <--- Importação do Dropdown
import { toast } from "sonner";
import { useSocket } from "@/contexts/SocketContext";

// IMPORTA O UTILITÁRIO DE EXPORTAÇÃO
import { exportToExcel, exportToPDF } from "@/utils/exportUtils";

export default function AuditLogs() {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  // --- ESTADOS DE FILTRO ---
  const [actionFilter, setActionFilter] = useState("ALL");
  const [userSearch, setUserSearch] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  // 1. BUSCAR LOGS
  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["audit-logs", actionFilter, userSearch, dateStart, dateEnd],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (actionFilter !== "ALL") params.append("action", actionFilter);
      if (userSearch) params.append("user", userSearch);
      if (dateStart) params.append("startDate", dateStart);
      if (dateEnd) params.append("endDate", dateEnd);

      const response = await api.get(`/admin/logs?${params.toString()}`);
      return response.data;
    },
  });

  // 2. ATUALIZAÇÃO EM TEMPO REAL
  useEffect(() => {
    if (socket) {
      socket.on('new_audit_log', (newLog: any) => {
        // Opção A: Recarregar tudo (Mais fácil)
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
        
        // Opção B: Adicionar manualmente na lista (Mais performático visualmente)
        // queryClient.setQueryData(["audit-logs", ...], (old: any) => [newLog, ...old]);
        
        toast("Novo evento de auditoria registrado", {
            description: `${newLog.user_name} - ${newLog.action}`,
            duration: 3000,
        });
      });

      return () => {
        socket.off('new_audit_log');
      };
    }
  }, [socket, queryClient]);

  // 3. FUNÇÃO DE EXPORTAÇÃO (NOVA)
  const handleExport = (type: 'pdf' | 'excel') => {
    if (!logs || logs.length === 0) {
        toast.error("Sem dados para exportar.");
        return;
    }

    // Formata os dados
    const exportData = logs.map((log: any) => {
        // Formata o JSON de detalhes para string legível
        let detailsString = "-";
        try {
            if (typeof log.details === 'object') {
                detailsString = JSON.stringify(log.details).substring(0, 500); // Limita tamanho
            } else if (log.details) {
                detailsString = String(log.details);
            }
        } catch (e) { detailsString = "Erro ao ler detalhes"; }

        return {
            ID: log.id,
            Data: format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss"),
            Usuário: log.user_name || "Desconhecido",
            Cargo: log.user_role || "-",
            Ação: log.action,
            IP: log.ip_address || "-",
            Detalhes: detailsString
        };
    });

    if (type === 'excel') {
        exportToExcel(exportData, "Relatorio_Auditoria");
        toast.success("Excel baixado!");
    } else {
        const columns = [
            { header: "Data", dataKey: "Data" },
            { header: "Usuário", dataKey: "Usuário" },
            { header: "Cargo", dataKey: "Cargo" },
            { header: "Ação", dataKey: "Ação" },
            { header: "Detalhes", dataKey: "Detalhes" }, // Cuidado com PDF, detalhes longos quebram layout
        ];
        exportToPDF("Relatório de Auditoria e Segurança", columns, exportData, "Auditoria_PDF");
        toast.success("PDF gerado!");
    }
  };

  // Cores das ações
  const getActionColor = (action: string) => {
    if (action.includes("LOGIN")) return "bg-blue-100 text-blue-700 border-blue-200";
    if (action.includes("DELETE")) return "bg-red-100 text-red-700 border-red-200";
    if (action.includes("UPDATE")) return "bg-amber-100 text-amber-700 border-amber-200";
    if (action.includes("CREATE")) return "bg-green-100 text-green-700 border-green-200";
    return "bg-slate-100 text-slate-700";
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Logs de Auditoria
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            Monitoramento de segurança e ações do sistema.
            {isConnected ? (
                <span className="flex items-center text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                    Ao Vivo
                </span>
            ) : (
                <span className="text-xs text-red-500 bg-red-100 px-2 py-0.5 rounded-full">Offline</span>
            )}
          </p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
            <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
            </Button>

            {/* BOTÃO EXPORTAR */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" className="gap-2">
                  <Download className="h-4 w-4" /> Exportar Logs
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('excel')} className="gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')} className="gap-2 cursor-pointer">
                  <FileText className="h-4 w-4 text-red-600" /> PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>

      {/* FILTROS */}
      <Card>
        <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Buscar Usuário</label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Nome ou Email..." 
                            className="pl-9"
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo de Ação</label>
                    <Select value={actionFilter} onValueChange={setActionFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todas as Ações</SelectItem>
                            <SelectItem value="LOGIN">Login</SelectItem>
                            <SelectItem value="CREATE_PRODUCT">Criar Produto</SelectItem>
                            <SelectItem value="UPDATE_PRODUCT">Editar Produto</SelectItem>
                            <SelectItem value="UPDATE_STOCK">Ajuste de Estoque</SelectItem>
                            <SelectItem value="DELETE_PRODUCT">Excluir Produto</SelectItem>
                            <SelectItem value="UPDATE_PERMISSIONS">Permissões</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Data Inicial</label>
                    <div className="relative">
                        <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="date" 
                            className="pl-9"
                            value={dateStart}
                            onChange={(e) => setDateStart(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Data Final</label>
                    <div className="relative">
                        <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="date" 
                            className="pl-9"
                            value={dateEnd}
                            onChange={(e) => setDateEnd(e.target.value)}
                        />
                    </div>
                </div>
            </div>
        </CardContent>
      </Card>

      {/* TABELA DE LOGS */}
      <div className="border rounded-lg bg-card shadow-sm overflow-hidden">
        <Table>
            <TableHeader className="bg-muted/50">
                <TableRow>
                    <TableHead className="w-[180px]">Data / Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Detalhes</TableHead>
                    <TableHead className="text-right">IP</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                            <div className="flex justify-center items-center gap-2">
                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                Carregando auditoria...
                            </div>
                        </TableCell>
                    </TableRow>
                ) : logs?.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                            Nenhum registro encontrado com esses filtros.
                        </TableCell>
                    </TableRow>
                ) : (
                    logs?.map((log: any) => (
                        <TableRow key={log.id} className="hover:bg-muted/20">
                            <TableCell className="font-mono text-xs">
                                {format(new Date(log.created_at), "dd/MM/yyyy")}
                                <br />
                                <span className="text-muted-foreground">{format(new Date(log.created_at), "HH:mm:ss")}</span>
                            </TableCell>
                            <TableCell className="font-medium">{log.user_name}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className="capitalize">
                                    {log.user_role?.replace('_', ' ')}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className={`font-mono text-[10px] ${getActionColor(log.action)}`}>
                                    {log.action}
                                </Badge>
                            </TableCell>
                            <TableCell className="max-w-[400px]">
                                <div className="text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded max-h-[60px] overflow-y-auto custom-scrollbar">
                                    {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                                </div>
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono text-muted-foreground">
                                {log.ip_address}
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
      </div>
    </div>
  );
}