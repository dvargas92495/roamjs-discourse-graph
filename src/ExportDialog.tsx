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
  getFullTreeByParentUid,
  getGraph,
  getPageViewType,
  getRoamUrl,
  getTextByBlockUid,
  getTreeByBlockUid,
  TreeNode,
  ViewType,
} from "roam-client";
import { createOverlayRender, MenuItemSelect } from "roamjs-components";
import {
  englishToDatalog,
  getDiscourseContextResults,
  getNodes,
  getPageMetadata,
  getRelations,
  matchNode,
  triplesToQuery,
} from "./util";
import format from "date-fns/format";
import download from "downloadjs";
import JSZip from "jszip";

type Props = {
  fromQuery?: {
    nodes: { title: string; uid: string }[];
    relations: {
      target: string;
      source: string;
      label: string;
    }[];
  };
};

const EXPORT_TYPES = ["CSV (neo4j)", "Markdown", "JSON"] as const;

const viewTypeToPrefix = {
  bullet: "- ",
  document: "",
  numbered: "1. ",
};

const collectUids = (t: TreeNode): string[] => [
  t.uid,
  ...t.children.flatMap(collectUids),
];

const normalize = (t: string) => `${t.replace(/[<>:"/\\|?*[]]/g, "")}.md`;

const titleToFilename = (t: string) => {
  const name = normalize(t);
  return name.length > 64
    ? `${name.substring(0, 31)}...${name.slice(-30)}`
    : name;
};

const toMarkdown = ({
  c,
  i = 0,
  v = "bullet",
}: {
  c: TreeNode;
  i?: number;
  v?: ViewType;
}): string =>
  `${"".padStart(i * 4, " ")}${viewTypeToPrefix[v]}${
    c.heading ? `${"".padStart(c.heading, "#")} ` : ""
  }${c.text
    .replace(BLOCK_REF_REGEX, (_, blockUid) => {
      const reference = getTextByBlockUid(blockUid);
      return reference || blockUid;
    })
    .trim()}${(c.children || [])
    .filter((nested) => !!nested.text || nested.children.length)
    .map(
      (nested) =>
        `\n\n${toMarkdown({ c: nested, i: i + 1, v: c.viewType || v })}`
    )
    .join("")}`;

const ExportDialog = ({
  onClose,
  fromQuery,
}: {
  onClose: () => void;
} & Props) => {
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
      title={`Export Discourse Graph`}
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
        {fromQuery && <span>Exporting {fromQuery.nodes.length} Pages</span>}
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
                const allNodes = getNodes();
                const translator = englishToDatalog(allNodes);
                const allPages = window.roamAlphaAPI
                  .q(
                    "[:find ?s ?u :where [?e :node/title ?s] [?e :block/uid ?u]]"
                  )
                  .map(([title, uid]) => ({ title, uid }));
                const pageData =
                  fromQuery?.nodes ||
                  allNodes.flatMap(({ format }) =>
                    allPages.filter(({ title }) => matchNode({ format, title }))
                  );
                const getRelationData = (relations = getRelations()) =>
                  fromQuery?.relations ||
                  relations.flatMap((s) =>
                    window.roamAlphaAPI
                      .q(
                        `[:find ?source-uid ?dest-uid :where [?${
                          s.triples.find(
                            (t) => t[2] === "source" || t[2] === s.source
                          )[0]
                        } :block/uid ?source-uid] [?${
                          s.triples.find(
                            (t) =>
                              t[2] === "destination" || t[2] === s.destination
                          )[0]
                        } :block/uid ?dest-uid] ${triplesToQuery(
                          s.triples.map((t) =>
                            t[2] === "source"
                              ? [t[0], t[1], s.source]
                              : t[2] === "destination"
                              ? [t[0], t[1], s.destination]
                              : t
                          ),
                          translator
                        )}]`
                      )
                      .map(([source, target]) => ({
                        source,
                        target,
                        label: s.label,
                      }))
                  );
                if (activeExportType === "CSV (neo4j)") {
                  const nodeHeader = "uid:ID,label:LABEL,title,author,date\n";
                  const nodeData = pageData
                    .map(({ title, uid }) => {
                      const value = title.replace(
                        new RegExp(`^\\[\\[\\w*\\]\\] - `),
                        ""
                      );
                      const { displayName, date } = getPageMetadata(title);
                      return `${uid},${(
                        allNodes.find(({ format }) =>
                          matchNode({ format, title })
                        )?.text || ""
                      ).toUpperCase()},${
                        value.includes(",") ? `"${value}"` : value
                      },${displayName},"${date.toLocaleString()}"`;
                    })
                    .join("\n");
                  zip.file(
                    `${filename.replace(/\.csv/, "")}_nodes.csv`,
                    `${nodeHeader}${nodeData}`
                  );

                  const relationHeader =
                    "start:START_ID,end:END_ID,label:TYPE\n";
                  const relationData = getRelationData().map(
                    ({ source, target, label }) =>
                      `${source},${target},${label.toUpperCase()}`
                  );
                  const relations = relationData.join("\n");
                  zip.file(
                    `${filename.replace(/\.csv/, "")}_relations.csv`,
                    `${relationHeader}${relations}`
                  );
                } else if (activeExportType === "Markdown") {
                  const pages = pageData.map(({ title, uid }) => {
                    const v = getPageViewType(title) || "bullet";
                    const { date, displayName, id } = getPageMetadata(title);
                    const treeNode = getTreeByBlockUid(uid);
                    const discourseResults = getDiscourseContextResults(
                      title,
                      allNodes
                    );
                    const referenceResults = window.roamAlphaAPI
                      .q(
                        `[:find (pull ?pr [:node/title]) (pull ?r [:block/heading [:block/string :as "text"] [:children/view-type :as "viewType"] {:block/children ...}]) :where [?p :node/title "${title}"] [?r :block/refs ?p] [?r :block/page ?pr]]`
                      )
                      .filter(([, { children = [] }]) => !!children.length);
                    const content = `---\ntitle: ${title}\nurl: ${getRoamUrl(
                      id
                    )}\nauthor: ${displayName}\ndate: ${format(
                      date,
                      "yyyy-MM-dd"
                    )}\n---\n\n${treeNode.children
                      .map((c) => toMarkdown({ c, v, i: 0 }))
                      .join("\n")}\n${
                      discourseResults.length
                        ? `\n###### Discourse Context\n\n${discourseResults
                            .flatMap((r) =>
                              Object.values(r.results).map(
                                (t) => `- **${r.label}:** [[${t}]]`
                              )
                            )
                            .join("\n")}\n`
                        : ""
                    }${
                      referenceResults.length
                        ? `\n###### References\n\n${referenceResults
                            .map(
                              (r) =>
                                `${r[0].title}\n\n${toMarkdown({ c: r[1] })}`
                            )
                            .join("\n")}\n`
                        : ""
                    }`;
                    const uids = new Set(collectUids(treeNode));
                    return { title, content, uids };
                  });
                  pages.forEach(({ title, content }) =>
                    zip.file(titleToFilename(title), content)
                  );
                } else {
                  const allRelations = getRelations();
                  const nodeLabelByType = Object.fromEntries(
                    allNodes.map((a) => [a.type, a.text])
                  );
                  const grammar = allRelations.map(
                    ({ label, destination, source }) => ({
                      label,
                      destination: nodeLabelByType[destination],
                      source: nodeLabelByType[source],
                    })
                  );
                  const nodes = pageData.map(({ title, uid }) => {
                    const { date, displayName } = getPageMetadata(title);
                    const { children } = getFullTreeByParentUid(uid);
                    return {
                      uid,
                      title,
                      children,
                      date: date.toJSON(),
                      createdBy: displayName,
                    };
                  });
                  const relations = getRelationData();
                  zip.file(
                    `${filename.replace(/\.json$/, "")}.json`,
                    JSON.stringify({ grammar, nodes, relations })
                  );
                }
                finish();
              }, 1);
            }}
          />
        </div>
      </div>
    </Dialog>
  );
};

export const render = createOverlayRender<Props>(
  "discourse-export",
  ExportDialog
);

export default ExportDialog;
