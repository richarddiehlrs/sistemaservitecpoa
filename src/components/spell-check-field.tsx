"use client";

import { SpellCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type BaseProps = {
  className?: string;
  hint?: boolean;
  inline?: boolean;
};

type InputProps = BaseProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "spellCheck" | "lang">;

type TextareaProps = BaseProps &
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "spellCheck" | "lang">;

function Hint({ show }: { show?: boolean }) {
  if (!show) return null;
  return (
    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
      <SpellCheck className="h-3 w-3" />
      Corretor ortográfico ativo — clique com o botão direito nas palavras sublinhadas
    </p>
  );
}

export function SpellCheckInput({ className, hint = false, inline = false, ...props }: InputProps) {
  const input = (
    <input
      {...props}
      spellCheck
      lang="pt-BR"
      autoCorrect="on"
      className={cn(inline ? className : cn("input", className))}
    />
  );
  if (inline) return input;
  return (
    <div>
      {input}
      <Hint show={hint} />
    </div>
  );
}

export function SpellCheckTextarea({
  className,
  hint = true,
  inline = false,
  rows = 2,
  ...props
}: TextareaProps) {
  const textarea = (
    <textarea
      {...props}
      rows={rows}
      spellCheck
      lang="pt-BR"
      autoCorrect="on"
      className={cn(inline ? className : cn("input", className))}
    />
  );
  if (inline) return textarea;
  return (
    <div>
      {textarea}
      <Hint show={hint} />
    </div>
  );
}
