import type { Root, RootContent } from "mdast";

/** Preserve English heading anchors in translated guides without enabling raw HTML. */
export default function remarkCanonicalHeadings() {
  return (tree: Root) => {
    function visit(node: Root | RootContent) {
      if (node.type === "heading") {
        const last = node.children.at(-1);
        if (last?.type === "text") {
          const match = /\s+\{#([a-z0-9][a-z0-9_-]*)\}$/.exec(last.value);
          if (match) {
            last.value = last.value.slice(0, match.index);
            node.data = {
              ...node.data,
              hProperties: { ...node.data?.hProperties, id: match[1] },
            };
          }
        }
      }
      if ("children" in node) {
        for (const child of node.children) visit(child);
      }
    }
    visit(tree);
  };
}
