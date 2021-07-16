import {
  Button,
  Classes,
  Dialog,
  InputGroup,
  Intent,
  Label,
  Spinner,
  SpinnerSize,
} from "@blueprintjs/core";
import React, { useState } from "react";
import {
  BLOCK_REF_REGEX,
  getGraph,
  getPageTitlesAndUidsDirectlyReferencingPage,
  getPageViewType,
  getTextByBlockUid,
  getTreeByBlockUid,
  TreeNode,
  ViewType,
} from "roam-client";
import { createOverlayRender, MenuItemSelect } from "roamjs-components";
import {
  getNodes,
  getRelations,
  NODE_TITLE_REGEX,
  triplesToQuery,
} from "./util";
import format from "date-fns/format";
import download from "downloadjs";
import JSZip from "jszip";

const EXPORT_TYPES = ["CSV (neo4j)", "Markdown"] as const;

const viewTypeToPrefix = {
  bullet: "- ",
  document: "",
  numbered: "1. ",
};

const collectUids = (t: TreeNode): string[] => [
  t.uid,
  ...t.children.flatMap(collectUids),
];

const titleToFilename = (t: string) =>
  `${t
    .replace(NODE_TITLE_REGEX, "$1 - ")
    .replace(/[<>:"/\\|?*]/, "")
    .replace(/ /g, "_")}.md`;

const NODE_REF_REGEX = new RegExp(
  `\\[\\[(${NODE_TITLE_REGEX.source}(.*?)(?:(?:\\s-\\s)?\\[\\[(.*?)\\]\\])?)\\]\\]`,
  "g"
);

const toMarkdown = ({
  c,
  i,
  v,
}: {
  c: TreeNode;
  i: number;
  v: ViewType;
}): string =>
  `${"".padStart(i * 4, " ")}${viewTypeToPrefix[v]}${
    c.heading ? `${"".padStart(c.heading, "#")} ` : ""
  }${c.text
    .replace(BLOCK_REF_REGEX, (_, blockUid) => {
      const reference = getTextByBlockUid(blockUid);
      return reference || blockUid;
    })
    .replace(
      NODE_REF_REGEX,
      (_, title, __, content) => `[${content}](./${titleToFilename(title)})`
    )
    .trim()}${c.children
    .filter((nested) => !!nested.text || nested.children.length)
    .map(
      (nested) =>
        `\n\n${toMarkdown({ c: nested, i: i + 1, v: c.viewType || v })}`
    )
    .join("")}`;

const ExportDialog = ({ onClose }: { onClose: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filename, setFilename] = useState(
    `${getGraph()}_discourse-graph_${format(new Date(), "yyyyMMddhhmm")}`
  );
  const [activeExportType, setActiveExportType] = useState<
    typeof EXPORT_TYPES[number]
  >(EXPORT_TYPES[0]);
  return (
    <Dialog
      isOpen={true}
      onClose={onClose}
      canEscapeKeyClose
      canOutsideClickClose
      title={`Export Discourse Graph to CSV`}
    >
      <div className={Classes.DIALOG_BODY}>
        <Label>
          Export Type
          <MenuItemSelect
            items={[...EXPORT_TYPES]}
            activeItem={activeExportType}
            onItemSelect={(et) => setActiveExportType(et)}
          />
        </Label>
        <Label>
          Filename
          <InputGroup
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
          />
        </Label>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <span style={{ color: "darkred" }}>{error}</span>
          {loading && <Spinner size={SpinnerSize.SMALL} />}
          <Button
            text={"Export"}
            intent={Intent.PRIMARY}
            onClick={() => {
              setLoading(true);
              setTimeout(() => {
                const zip = new JSZip();
                const finish = () =>
                  zip.generateAsync({ type: "blob" }).then((content) => {
                    download(content, `${filename}.zip`, "application/zip");
                    onClose();
                  });
                if (activeExportType === "CSV (neo4j)") {
                  const nodeHeader = "uid:ID,label:LABEL,title\n";
                  const nodeData = getNodes()
                    .flatMap((n) =>
                      getPageTitlesAndUidsDirectlyReferencingPage(n.abbr).map(
                        ({ title, uid }) => {
                          const value = title.replace(
                            new RegExp(`\\[\\[${n.abbr}\\]\\] - `),
                            ""
                          );
                          return `${uid},${n.text.toUpperCase()},${
                            value.includes(",") ? `"${value}"` : value
                          }`;
                        }
                      )
                    )
                    .join("\n");
                  zip.file(
                    `${filename.replace(/\.csv/, "")}_nodes.csv`,
                    `${nodeHeader}${nodeData}`
                  );

                  const relationHeader =
                    "start:START_ID,end:END_ID,label:TYPE\n";
                  const relations = getRelations()
                    .flatMap((s) =>
                      window.roamAlphaAPI
                        .q(
                          `[:find ?source-uid ?dest-uid :where [?${
                            s.triples.find((t) => t[2] === s.source)[0]
                          } :block/uid ?source-uid] [?${
                            s.triples.find((t) => t[2] === s.destination)[0]
                          } :block/uid ?dest-uid] ${triplesToQuery(s.triples)}]`
                        )
                        .map(
                          ([start, end]) =>
                            `${start},${end},${s.label.toUpperCase()}`
                        )
                    )
                    .join("\n");
                  zip.file(
                    `${filename.replace(/\.csv/, "")}_relations.csv`,
                    `${relationHeader}${relations}`
                  );
                  finish();
                } else if (activeExportType === "Markdown") {
                  const pages = getNodes().flatMap((n) =>
                    getPageTitlesAndUidsDirectlyReferencingPage(n.abbr).map(
                      ({ title, uid }) => {
                        const v = getPageViewType(title) || "bullet";
                        const treeNode = getTreeByBlockUid(uid);
                        const content = treeNode.children
                          .map((c) => toMarkdown({ c, v, i: 0 }))
                          .join("\n");
                        const uids = new Set(collectUids(treeNode));
                        return { title, content, uids };
                      }
                    )
                  );
                  Promise.all(
                    pages.map(({ title, content }) =>
                      zip.file(titleToFilename(title), content)
                    )
                  ).then(finish);
                }
              }, 1);
            }}
          />
        </div>
      </div>
    </Dialog>
  );
};

export const render = createOverlayRender<{}>("discourse-export", ExportDialog);

export default ExportDialog;
