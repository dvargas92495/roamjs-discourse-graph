import {
  // BLOCK_REF_REGEX,
  // getTreeByBlockUid,
  toConfig,
  // TreeNode,
} from "roam-client";
import { createConfigObserver } from "roamjs-components";
import { render } from "./NodeMenu";
import { render as exportRender } from "./ExportDialog";

/*
declare global {
  interface Window {
    roamjs?: {
      discourseGraph?: {
        [k: string]: (a: unknown) => unknown;
      };
    };
  }
}

const relationLabels = ["SUPPORTS", "OPPOSES", "INFORMS"] as const;
type NODE_LABEL = "CLAIM" | "EVIDENCE" | "RESOURCE";
type RELATION_LABEL = typeof relationLabels[number];

type Node = {
  properties: Record<string, string>;
  id: string;
  labels: Set<NODE_LABEL>;
};

type Relation = {
  properties: Record<string, string>;
  id: string;
  label: RELATION_LABEL;
  fromId: string;
  toId: string;
};

const discourseGraph = {
  nodes: {} as { [uid: string]: Node },
  relations: {} as { [uid: string]: Relation },
};

const addClaim = (n: TreeNode) =>
  (discourseGraph.nodes[n.uid] = {
    id: n.uid,
    labels: new Set(["CLAIM"]),
    properties: {
      content: n.text,
    },
  });

const addEvidence = (n: TreeNode) => {
  discourseGraph.nodes[n.uid] = {
    id: n.uid,
    labels: new Set(["EVIDENCE"]),
    properties: {
      content: n.text,
    },
  };
  const relationLabelSet = new Set<string>(relationLabels);
  n.children.forEach((c) => {
    const [label, nodeRef] = c.text.split("::").map((s) => s.trim());
    const relation = label.toUpperCase();
    if (nodeRef && relationLabelSet.has(relation)) {
      const toId = new RegExp(BLOCK_REF_REGEX.source).exec(nodeRef)?.[1];
      if (toId) {
        discourseGraph.relations[c.uid] = {
          id: c.uid,
          toId,
          fromId: n.uid,
          label: relation as RELATION_LABEL,
          properties: {},
        };
      }
    }
  });
};
*/

const CONFIG = toConfig("discourse-graph");
createConfigObserver({ title: CONFIG, config: { tabs: [] } });

const triggerRegex = /\\/;
document.addEventListener("input", (e) => {
  const target = e.target as HTMLElement;
  if (
    target.tagName === "TEXTAREA" &&
    target.classList.contains("rm-block-input")
  ) {
    const textarea = target as HTMLTextAreaElement;
    const valueToCursor = textarea.value.substring(0, textarea.selectionStart);
    if (triggerRegex.test(valueToCursor)) {
      render({ textarea });
    }
  }
});

window.roamAlphaAPI.ui.commandPalette.addCommand({
  label: "Export Property Graph CSV",
  callback: () => exportRender({}),
});
