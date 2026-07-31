import type { ComponentPropsWithoutRef } from "react";

/**
 * Forskningsrutan (MG-beslut 2026-07-31, Lisas gradering): en blockquote vars
 * första rad är "**Forskning: …**" renderas som markerad ruta med tenantens
 * app-ikon + textetiketten som redan står i innehållet. Detektionen läser
 * markdown-AST:ens text — innehållet röres ALDRIG (verbatim-regeln), markören
 * är enbart presentation. Övriga blockquotes (t.ex. citat) renderas som vanligt.
 * Ikonen kommer ur brand_spec.mark_svg och renderas som <img data:>-URI —
 * aldrig som rå DOM (SVG i <img> kan inte köra skript).
 */

type HastNode = { type?: string; value?: string; children?: HastNode[] };

function textOf(node: HastNode | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textOf).join("");
}

export function makeBlockquote(markSvg: string | null) {
  return function Blockquote({
    node,
    children,
    ...rest
  }: ComponentPropsWithoutRef<"blockquote"> & { node?: unknown }) {
    if (!/^\s*Forskning:/.test(textOf(node as HastNode))) {
      return <blockquote {...rest}>{children}</blockquote>;
    }
    return (
      <blockquote {...rest} className="forskningsruta">
        {markSvg && (
          // eslint-disable-next-line @next/next/no-img-element -- data-URI, ingen optimeringsvinst
          <img
            src={`data:image/svg+xml;utf8,${encodeURIComponent(markSvg)}`}
            alt=""
            aria-hidden
            className="forskningsruta-ikon"
          />
        )}
        {children}
      </blockquote>
    );
  };
}
