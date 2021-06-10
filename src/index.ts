import {
  BLOCK_REF_REGEX,
  getTreeByBlockUid,
  toConfig,
  TreeNode,
} from "roam-client";
import { createConfigObserver } from "roamjs-components";

declare global {
  interface Window {
    roamjs?: {
      discourseGraph?: {
        [k: string]: (a: unknown) => unknown;
      };
    };
  }
}

const relationLabels = ["SUPPORTS" , "OPPOSES" , "INFORMS"] as const;
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

const CONFIG = toConfig("discourse-graph");
createConfigObserver({ title: CONFIG, config: { tabs: [] } });

console.log("Creating local graph");
const discourseGraph = {
  nodes: {} as { [uid: string]: Node },
  relations: {} as { [uid: string]: Relation },
};
console.log("done");

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
          properties: {}
        };
      }
    }
  });
};

const select = (
  resultSet: Record<string, Node | Relation>[],
  value: string
) => {
  return resultSet.map((r) => r[value]);
};

const matchQuery = (parts: string[]) => {
  const [pattern, predicate, value] = parts;
  const patternParts = pattern.split(/(?:<-|->|-)/).map((s) => {
    const possibleNode = /\((\w*):(\w*)\)/.exec(s);
    if (possibleNode) {
      return {
        isNode: true,
        var: possibleNode[1],
        label: possibleNode[2],
      };
    }
    const possibleRelation = /\[(\w*):(\w*)\]/.exec(s);
    if (possibleRelation) {
      return {
        isNode: false,
        var: possibleRelation[1],
        label: possibleRelation[2],
      };
    }
    return undefined;
  });
  const resultSet = patternParts.reduce((resultSet, part, i) => {
    if (i === 0) {
      const matchedNodes = Object.values(discourseGraph.nodes).filter((v) =>
        v.labels.has(part.label.toUpperCase() as NODE_LABEL)
      );
      return matchedNodes.map((n) => ({
        [part.var]: { ...n.properties, id: n.id },
      }));
    }
    return resultSet.flatMap((r) => {
      if (part.isNode) {
        const { toId } = r[patternParts[i - 1].var];
        const n = discourseGraph.nodes[toId];
        return n.labels.has(part.label.toUpperCase() as NODE_LABEL)
          ? [{ ...r, [part.var]: { ...n.properties, id: n.id } }]
          : [];
      } else {
        const { id } = r[patternParts[i - 1].var];
        const nodes = Object.values(discourseGraph.relations).filter(
          (v) => v.label === part.label && v.fromId === id
        );
        return nodes.map((n) => ({
          ...r,
          [part.var]: {
            ...n.properties,
            toId: n.toId,
            fromId: n.fromId,
            label: n.label,
          },
        }));
      }
    });
  }, []);
  switch (predicate.toUpperCase()) {
    case "RETURN":
      return select(resultSet, value);
    default:
      throw new Error(`Unsupported predicate ${predicate}`);
  }
};

const query = (queryString: string) => {
  const parts = queryString.split(/\s/);
  const queryType = parts[0].toUpperCase();
  switch (queryType) {
    case "MATCH":
      return matchQuery(parts.slice(1));
    default:
      throw new Error(`Unsupported query type: ${parts[0]}`);
  }
};

if (typeof window.roamjs === "undefined") {
  window.roamjs = {};
}

window.roamjs.discourseGraph = {
  addClaim,
  addEvidence,
  getTreeByBlockUid,
  query,
};
