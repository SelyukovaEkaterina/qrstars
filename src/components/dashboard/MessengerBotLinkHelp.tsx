"use client";

import Button from "@/components/ui/Button";
import { CheckCircle2, Copy, ExternalLink } from "lucide-react";

interface MessengerBotLinkHelpProps {
  botUrl: string | null;
  linkCode: string;
  codeCopied: boolean;
  onCopyCode: () => void;
  /** Подсказка над кодом (разная для Telegram и MAX). */
  codeHint: string;
}

export default function MessengerBotLinkHelp({
  botUrl,
  linkCode,
  codeCopied,
  onCopyCode,
  codeHint,
}: MessengerBotLinkHelpProps) {
  return (
    <div className="space-y-3">
      {botUrl && (
        <a
          href={botUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 break-all"
        >
          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          {botUrl}
        </a>
      )}

      <div>
        <p className="text-xs text-gray-500 mb-2">{codeHint}</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 bg-white border rounded-lg text-sm font-mono select-all break-all">
            {linkCode}
          </code>
          <Button size="sm" variant="ghost" onClick={onCopyCode} aria-label="Скопировать код">
            {codeCopied ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
