"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "@/components/ui/code-block";
import { Send, RefreshCw, Zap, type LucideIcon } from "lucide-react";

const HEADING_ICONS: Record<string, LucideIcon> = {
  "full pipeline": Zap,
  "trigger a deploy": Send,
  "check deploy status": RefreshCw,
};

const iconForHeading = (text: string) => {
  const normalized = text.toLowerCase().trim();
  return HEADING_ICONS[normalized];
};

interface MarkdownContentProps {
  content: string;
}

/**
 * Renders markdown with custom components that match our design system.
 * Code blocks use our CodeBlock component; headings get icons and styling.
 */
const MarkdownContent = ({ content }: MarkdownContentProps) => {
  const headingComponent = (level: 1 | 2 | 3 | 4 | 5 | 6) =>
    function Heading({ children }: { children?: React.ReactNode }) {
      const text = String(children);
      const Icon = iconForHeading(text);
      const Tag = `h${level}` as const;

      const sizeClass =
        level === 1
          ? "text-4xl font-bold font-serif italic leading-tight"
          : level === 2
            ? "text-xl font-semibold tracking-tight"
            : "text-xs font-semibold tracking-wider uppercase text-muted-foreground";

      const wrapperClass =
        level === 2
          ? "mt-8 first:mt-0"
          : level >= 3
            ? "mt-6 pt-4 border-t border-border/50 first:border-0 first:mt-0 first:pt-0"
            : "";

      return (
        <div className={`flex items-center gap-2.5 ${wrapperClass}`}>
          {Icon && (
            <div className={`flex shrink-0 items-center justify-center rounded-lg ${level === 1 ? "size-10 bg-primary/10 text-primary" : "size-7 bg-muted text-muted-foreground"}`}>
              <Icon className={level === 1 ? "size-5" : "size-3.5"} />
            </div>
          )}
          <Tag className={sizeClass}>{children}</Tag>
        </div>
      );
    };

  return (
    <div className="space-y-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        code({ className, children, ...props }) {
          const isBlock = Boolean(className?.includes("language-"));

          if (isBlock) {
            const language = className?.replace("language-", "") || undefined;
            const code = String(children).replace(/\n$/, "");
            return <CodeBlock code={code} language={language} />;
          }

          return (
            <code
              className="rounded bg-muted px-1.5 py-0.5 text-xs"
              {...props}
            >
              {children}
            </code>
          );
        },
        h1: headingComponent(1),
        h2: headingComponent(2),
        h3: headingComponent(3),
        h4: headingComponent(4),
        h5: headingComponent(5),
        h6: headingComponent(6),
        ul({ children }) {
          return <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/70 leading-relaxed">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal pl-5 space-y-1 text-sm text-foreground/70 leading-relaxed">{children}</ol>;
        },
        li({ children }) {
          return <li>{children}</li>;
        },
        p({ children, ...props }) {
          // First paragraph after h1 — subtitle style
          const parent = (props as Record<string, unknown>).node as { position?: { start: { line: number } } } | undefined;
          const isFirst = parent?.position?.start?.line === 3;
          return (
            <p
              className={
                isFirst
                  ? "text-base text-foreground/70 leading-relaxed"
                  : "text-sm text-foreground/70 leading-relaxed"
              }
            >
              {children}
            </p>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
};

export default MarkdownContent;