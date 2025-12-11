import React, { useState, useEffect } from "react";

// --- Utility ---
const cn = (...classes) => classes.filter(Boolean).join(" ");

// --- Componente: SVG Spinner (Loader Circular) ---
const SvgSpinner = () => {
  return (
    <div className="relative flex items-center justify-center">
      <style>
        {`
          .svg-loader {
            width: 3.25em;
            transform-origin: center;
            animation: rotate4 2s linear infinite;
          }

          .svg-circle {
            fill: none;
            /* Cor Azul Royal (#1d4ed8 equivale ao blue-700 do Tailwind) */
            stroke: #1d4ed8; 
            stroke-width: 2;
            stroke-dasharray: 1, 200;
            stroke-dashoffset: 0;
            stroke-linecap: round;
            animation: dash4 1.5s ease-in-out infinite;
          }

          @keyframes rotate4 {
            100% {
              transform: rotate(360deg);
            }
          }

          @keyframes dash4 {
            0% {
              stroke-dasharray: 1, 200;
              stroke-dashoffset: 0;
            }
            50% {
              stroke-dasharray: 90, 200;
              stroke-dashoffset: -35px;
            }
            100% {
              stroke-dashoffset: -125px;
            }
          }
        `}
      </style>
      
      {/* Container minimalista */}
      <div className="p-4 bg-white/50 rounded-full backdrop-blur-sm">
        <svg className="svg-loader" viewBox="25 25 50 50">
          <circle className="svg-circle" r="20" cy="50" cx="50"></circle>
        </svg>
      </div>
    </div>
  );
};

// --- Componente Principal da Tela de Carregamento ---
interface LoadingScreenProps {
  className?: string;
  isLoading?: boolean;
}

export function LoadingScreen({ 
  className, 
  isLoading = true 
}: LoadingScreenProps) {
  const [shouldRender, setShouldRender] = useState(isLoading);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setIsFading(true);
      // Aguarda a animação de fade-out terminar antes de remover do DOM
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 700);
      return () => clearTimeout(timer);
    } else {
      setShouldRender(true);
      setIsFading(false);
    }
  }, [isLoading]);

  if (!shouldRender) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex flex-col items-center justify-center",
        "bg-white/95 backdrop-blur-xl", // Fundo branco limpo
        "transition-opacity duration-700 ease-in-out",
        isFading ? "opacity-0 pointer-events-none" : "opacity-100",
        className
      )}
    >
      {/* Loader aumentado para destaque */}
      <div className="scale-150 transform">
        <SvgSpinner />
      </div>
    </div>
  );
}

// --- Aplicação Demo ---
export default function App() {
  // Simplesmente renderiza a tela de carregamento ativa
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
      <LoadingScreen isLoading={true} />
    </div>
  );
}