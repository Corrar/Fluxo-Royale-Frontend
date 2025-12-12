import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Lock, User, ArrowRight, Loader2 } from "lucide-react";

export default function Auth() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // --- CORREÇÃO AQUI: Redirecionar para /inicio se já estiver logado ---
  useEffect(() => {
    if (user) {
      navigate("/inicio");
    }
  }, [user, navigate]);

  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [passwordStrength, setPasswordStrength] = useState(0);

  // 1. Lógica para aceitar SOMENTE NÚMEROS no ID
  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Regex: ^\d*$ significa "apenas dígitos do início ao fim"
    if (/^\d*$/.test(value)) {
      setLoginId(value);
    }
  };

  // 2. Lógica para calcular força da senha
  const calculatePasswordStrength = (password: string) => {
    let score = 0;
    if (!password) return 0;

    if (password.length > 4) score += 1; // Tamanho decente
    if (password.length > 7) score += 1; // Tamanho bom
    if (/[0-9]/.test(password)) score += 1; // Tem números
    if (/[^A-Za-z0-9]/.test(password)) score += 1; // Tem símbolos

    return score; // Retorna de 0 a 4
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLoginPassword(value);
    setPasswordStrength(calculatePasswordStrength(value));
  };

  // Cores da barra de força
  const getStrengthColor = (score: number) => {
    if (score <= 1) return "bg-red-500";
    if (score === 2) return "bg-yellow-500";
    if (score === 3) return "bg-blue-400";
    return "bg-green-500";
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação mínima de 3 números
    if (loginId.length < 3) {
      toast.error("O ID de usuário deve ter no mínimo 3 números.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await signIn(loginId, loginPassword);
      
      if (error) {
        toast.error("Credenciais inválidas. Verifique seu ID e senha.");
      } else {
        toast.success("Bem-vindo de volta!");
        // A navegação ocorre automaticamente pelo useEffect acima ou pelo AuthContext
      }
    } catch (error) {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0a] relative overflow-hidden font-sans">
      
      {/* --- FUNDO AMBIENTE (Agora tudo AZUL) --- */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-700/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-cyan-600/20 rounded-full blur-[100px]" />
      
      {/* Grade Sutil no Fundo */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

      {/* --- CARD DE LOGIN --- */}
      <div className="w-full max-w-md p-8 relative z-10">
        
        {/* Vidro */}
        <div className="absolute inset-0 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl" />
        
        <div className="relative z-20 px-4 py-6">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-100 to-cyan-300 mb-2">
              Fluxo Royale
            </h1>
            <p className="text-gray-400 text-sm">
              Entre para gerenciar seu estoque
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            
            {/* Campo ID (Só Números) */}
            <div className="space-y-2">
              <Label className="text-gray-300 text-xs uppercase tracking-wider ml-1">ID de Usuário (Numérico)</Label>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors">
                  <User className="h-5 w-5" />
                </div>
                <Input
                  type="text"
                  placeholder="Ex: 1050"
                  value={loginId}
                  onChange={handleIdChange} // Usa a função que bloqueia letras
                  className="pl-10 h-12 bg-black/20 border-white/10 text-white placeholder:text-gray-600 rounded-xl focus:border-blue-500/50 focus:ring-blue-500/20 transition-all"
                  required
                  minLength={3}
                />
              </div>
            </div>

            {/* Campo Senha + Barra de Força */}
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <Label className="text-gray-300 text-xs uppercase tracking-wider">Senha</Label>
              </div>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors">
                  <Lock className="h-5 w-5" />
                </div>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={handlePasswordChange}
                  className="pl-10 h-12 bg-black/20 border-white/10 text-white placeholder:text-gray-600 rounded-xl focus:border-blue-500/50 focus:ring-blue-500/20 transition-all"
                  required
                />
              </div>

              {/* BARRA DE SEGURANÇA (Só aparece se digitar algo) */}
              {loginPassword.length > 0 && (
                <div className="space-y-1 mt-2 animate-in fade-in slide-in-from-top-1">
                  <div className="flex gap-1 h-1.5">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`flex-1 rounded-full transition-all duration-500 ${
                          passwordStrength >= level ? getStrengthColor(passwordStrength) : "bg-gray-700/50"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-right text-gray-400 uppercase tracking-widest">
                    {passwordStrength === 0 && "Muito Fraca"}
                    {passwordStrength === 1 && "Fraca"}
                    {passwordStrength === 2 && "Média"}
                    {passwordStrength === 3 && "Forte"}
                    {passwordStrength === 4 && "Muito Forte"}
                  </p>
                </div>
              )}
            </div>

            {/* Botão */}
            <Button 
              type="submit" 
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  Acessar Sistema <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-500 text-sm">
              Problemas no acesso?{" "}
              <span className="text-gray-400 cursor-not-allowed hover:text-white transition-colors">
                Contate o suporte
              </span>
            </p>
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-4 text-center w-full">
        <p className="text-white/20 text-xs">© 2025 Fluxo Royale. Ambiente Seguro.</p>
      </div>
    </div>
  );
}