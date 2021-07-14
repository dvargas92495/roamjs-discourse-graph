import { getTreeByPageName } from "roam-client";
import { toFlexRegex } from "roamjs-components";

export const DEFAULT_NODE_VALUES = [
  { text: "CLM", children: [{ text: "Claim" }, { text: "C" }] },
  { text: "QUE", children: [{ text: "Question" }, { text: "Q" }] },
  { text: "EVD", children: [{ text: "Evidence" }, { text: "E" }] },
  { text: "SOU", children: [{ text: "Source" }, { text: "S" }] },
  { text: "EXC", children: [{ text: "Excerpt" }, { text: "X" }] },
  { text: "AUT", children: [{ text: "Author" }, { text: "A" }] },
];
export const DEFAULT_RELATION_VALUES = [
  { text: "Informs", children: [{ text: "" }] },
  { text: "Supports" },
  { text: "Opposes" },
];

export const getNodeLabels = () =>
  (
    (
      getTreeByPageName("roam/js/discourse-graph").find((t) =>
        toFlexRegex("grammar").test(t.text)
      )?.children || []
    ).find((t) => toFlexRegex("nodes").test(t.text))?.children ||
    DEFAULT_NODE_VALUES
  ).map((n) => ({
    abbr: n.text,
    text: n.children[0]?.text || "",
    shortcut: n.children[1]?.text || "",
  }));
