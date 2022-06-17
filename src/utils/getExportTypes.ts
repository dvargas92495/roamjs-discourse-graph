import { BLOCK_REF_REGEX } from "roamjs-components/dom/constants";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getPageViewType from "roamjs-components/queries/getPageViewType";
import { TreeNode, ViewType } from "roamjs-components/types";
import { Result } from "roamjs-components/types/query-builder";
import getSettingIntFromTree from "roamjs-components/util/getSettingIntFromTree";
import getSubTree from "roamjs-components/util/getSubTree";
import {
  getNodes,
  matchNode,
  getRelations,
  getPageMetadata,
  isFlagEnabled,
  getDiscourseContextResults,
} from "../util";
import XRegExp from "xregexp";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";

const getContentFromNodes = ({
  title,
  allNodes,
}: {
  title: string;
  allNodes: ReturnType<typeof getNodes>;
}) => {
  const nodeFormat = allNodes.find((a) =>
    matchNode({ title, format: a.format })
  )?.format;
  if (!nodeFormat) return title;
  const regex = new RegExp(
    `^${nodeFormat
      .replace(/\[/g, "\\[")
      .replace(/]/g, "\\]")
      .replace("{content}", "(.*?)")
      .replace(/{[^}]+}/g, "(?:.*?)")}$`
  );
  return regex.exec(title)?.[1] || title;
};

const getFilename = ({
  title,
  maxFilenameLength,
  simplifiedFilename,
  allNodes,
  removeSpecialCharacters,
}: {
  title: string;
  maxFilenameLength: number;
  simplifiedFilename: boolean;
  allNodes: ReturnType<typeof getNodes>;
  removeSpecialCharacters: boolean;
}) => {
  const baseName = simplifiedFilename
    ? getContentFromNodes({ title, allNodes })
    : title;
  const name = `${
    removeSpecialCharacters
      ? baseName.replace(/[<>:"/\\|\?*[\]]/g, "")
      : baseName
  }.md`;

  return name.length > maxFilenameLength
    ? `${name.substring(
        0,
        Math.ceil((maxFilenameLength - 3) / 2)
      )}...${name.slice(-Math.floor((maxFilenameLength - 3) / 2))}`
    : name;
};

const uniqJsonArray = <T extends unknown>(arr: T[]) =>
  Array.from(
    new Set(
      arr.map((r) =>
        JSON.stringify(
          Object.entries(r).sort(([k], [k2]) => k.localeCompare(k2))
        )
      )
    )
  ).map((entries) => Object.fromEntries(JSON.parse(entries))) as T[];
const viewTypeToPrefix = {
  bullet: "- ",
  document: "",
  numbered: "1. ",
};

const collectUids = (t: TreeNode): string[] => [
  t.uid,
  ...t.children.flatMap(collectUids),
];

const MATCHES_NONE = /$.+^/;
const EMBED_REGEX = /{{(?:\[\[)embed(?:\]\]):\s*\(\(([\w\d-]{9,10})\)\)\s*}}/;

const toMarkdown = ({
  c,
  i = 0,
  v = "bullet",
  opts,
}: {
  c: TreeNode;
  i?: number;
  v?: ViewType;
  opts: {
    refs: boolean;
    embeds: boolean;
    simplifiedFilename: boolean;
    maxFilenameLength: number;
    allNodes: ReturnType<typeof getNodes>;
    removeSpecialCharacters: boolean;
  };
}): string => {
  const processedText = c.text
    .replace(opts.refs ? BLOCK_REF_REGEX : MATCHES_NONE, (_, blockUid) => {
      const reference = getTextByBlockUid(blockUid);
      return reference || blockUid;
    })
    .replace(opts.embeds ? EMBED_REGEX : MATCHES_NONE, (_, blockUid) => {
      const reference = getFullTreeByParentUid(blockUid);
      return toMarkdown({ c: reference, i, v, opts });
    })
    .trim();
  const finalProcessedText = opts.simplifiedFilename
    ? XRegExp.matchRecursive(processedText, "#?\\[\\[", "\\]\\]", "i", {
        valueNames: ["between", "left", "match", "right"],
        unbalanced: "skip",
      })
        .map((s) => {
          if (s.name === "match") {
            const name = getFilename({
              title: s.value,
              allNodes: opts.allNodes,
              maxFilenameLength: opts.maxFilenameLength,
              simplifiedFilename: opts.simplifiedFilename,
              removeSpecialCharacters: opts.removeSpecialCharacters,
            });
            return `[${name}](${name})`;
          } else if (s.name === "left" || s.name === "right") {
            return "";
          } else {
            return s.value;
          }
        })
        .join("") || processedText
    : processedText;
  return `${"".padStart(i * 4, " ")}${viewTypeToPrefix[v]}${
    c.heading ? `${"".padStart(c.heading, "#")} ` : ""
  }${finalProcessedText}${(c.children || [])
    .filter((nested) => !!nested.text || !!nested.children?.length)
    .map(
      (nested) =>
        `\n\n${toMarkdown({ c: nested, i: i + 1, v: c.viewType || v, opts })}`
    )
    .join("")}`;
};

type Props = {
  results?: Result[];
  relations?: {
    target: string;
    source: string;
    label: string;
  }[];
};

const getExportTypes = ({
  results,
  relations,
}: Props): Parameters<
  typeof window.roamjs.extension.queryBuilder.ExportDialog
>[0]["exportTypes"] => {
  const allNodes = getNodes();
  const nodeLabelByType = Object.fromEntries(
    allNodes.map((a) => [a.type, a.text])
  );
  nodeLabelByType["*"] = "Any";
  const getPageData = (): (Result & { type: string })[] => {
    const allPages = window.roamAlphaAPI
      .q("[:find (pull ?e [:block/uid :node/title]) :where [?e :node/title _]]")
      .map(([{ title, uid }]: [Record<string, string>]) => ({
        text: title,
        uid,
      }));
    return allNodes.flatMap(({ format, text }) =>
      (results
        ? results.flatMap((r) =>
            Object.keys(r)
              .filter((k) => k.endsWith(`-uid`))
              .map((k) => ({
                ...r,
                text: r[k.slice(0, -4)].toString(),
                uid: r[k] as string,
              }))
              .concat({
                text: r.text,
                uid: r.uid,
              })
          )
        : allPages
      )
        .filter(({ text }) => matchNode({ format, title: text }))
        .map((node) => ({ ...node, type: text }))
    );
  };
  const getRelationData = (rels?: ReturnType<typeof getRelations>) =>
    Promise.resolve(relations) ||
    Promise.all(
      (rels || getRelations())
        .filter(
          (s) =>
            s.triples.some((t) => t[2] === "source") &&
            s.triples.some((t) => t[2] === "destination")
        )
        .flatMap((s) => {
          return window.roamjs.extension.queryBuilder
            .fireQuery({
              returnNode: s.source,
              conditions: [
                {
                  relation: s.label,
                  source: nodeLabelByType[s.source],
                  target: nodeLabelByType[s.destination],
                  uid: s.id,
                  type: "clause",
                },
              ],
              selections: [],
            })
            .then((results) =>
              results.map((result) => ({
                source: s.source,
                target: result.uid,
                label: s.label,
              }))
            );
        })
    ).then((r) => r.flat());
  const getJsonData = () => {
    const allRelations = getRelations();
    const grammar = allRelations.map(({ label, destination, source }) => ({
      label,
      destination: nodeLabelByType[destination],
      source: nodeLabelByType[source],
    }));
    const nodes = getPageData().map(({ text, uid }) => {
      const { date, displayName } = getPageMetadata(text);
      const { children } = getFullTreeByParentUid(uid);
      return {
        uid,
        title: text,
        children,
        date: date.toJSON(),
        createdBy: displayName,
      };
    });
    const nodeSet = new Set(nodes.map((n) => n.uid));
    return getRelationData().then((rels) => {
      const relations = uniqJsonArray(
        rels.filter((r) => nodeSet.has(r.source) && nodeSet.has(r.target))
      );
      return { grammar, nodes, relations };
    });
  };

  return [
    {
      name: "Neo4j",
      callback: ({ filename }) => {
        const nodeHeader = "uid:ID,label:LABEL,title,author,date\n";
        const nodeData = getPageData()
          .map(({ text, uid, type }) => {
            const value = text.replace(new RegExp(`^\\[\\[\\w*\\]\\] - `), "");
            const { displayName, date } = getPageMetadata(text);
            return `${uid},${type.toUpperCase()},${
              value.includes(",") ? `"${value}"` : value
            },${displayName},"${date.toLocaleString()}"`;
          })
          .join("\n");
        const relationHeader = "start:START_ID,end:END_ID,label:TYPE\n";
        return getRelationData().then((rels) => {
          const relationData = rels.map(
            ({ source, target, label }) =>
              `${source},${target},${label.toUpperCase()}`
          );
          const relations = relationData.join("\n");
          return [
            {
              title: `${filename.replace(/\.csv/, "")}_nodes.csv`,
              content: `${nodeHeader}${nodeData}`,
            },
            {
              title: `${filename.replace(/\.csv/, "")}_relations.csv`,
              content: `${relationHeader}${relations}`,
            },
          ];
        });
      },
    },
    {
      name: "Markdown",
      callback: async () => {
        const configTree = getBasicTreeByParentUid(
          getPageUidByPageTitle("roam/js/discourse-graph")
        );
        const exportTree = getSubTree({
          tree: configTree,
          key: "export",
        });
        const maxFilenameLength = getSettingIntFromTree({
          tree: exportTree.children,
          key: "max filename length",
          defaultValue: 64,
        });
        const linkType = getSettingValueFromTree({
          tree: exportTree.children,
          key: "link type",
          defaultValue: "alias",
        });
        const toLink = (s: string) => {
          if (linkType === "wikilinks") return `[[${s.replace(/\.md$/, "")}]]`;
          if (linkType === "alias") return `[${s}](${s})`;
          return s;
        };
        const removeSpecialCharacters = !!getSubTree({
          tree: exportTree.children,
          key: "remove special characters",
        }).uid;
        const simplifiedFilename = !!getSubTree({
          tree: exportTree.children,
          key: "simplified filename",
        }).uid;
        const frontmatter = getSubTree({
          tree: exportTree.children,
          key: "frontmatter",
        }).children.map((t) => t.text);
        const optsRefs = !!getSubTree({
          tree: exportTree.children,
          key: "resolve block references",
        }).uid;
        const optsEmbeds = !!getSubTree({
          tree: exportTree.children,
          key: "resolve block embeds",
        }).uid;
        const yaml = frontmatter.length
          ? frontmatter
          : [
              "title: {text}",
              `url: https://roamresearch.com/#/app/${window.roamAlphaAPI.graph.name}/page/{uid}`,
              `author: {author}`,
              "date: {date}",
            ];
        const pages = await Promise.all(
          getPageData().map(({ text, uid, context: _, type, ...rest }) => {
            const v = getPageViewType(text) || "bullet";
            const { date, displayName } = getPageMetadata(text);
            const resultCols = Object.keys(rest).filter(
              (k) => !k.includes("uid")
            );
            const yamlLines = yaml.concat(
              resultCols.map((k) => `${k}: {${k}}`)
            );
            const result: Result = {
              ...rest,
              date,
              text,
              uid,
              author: displayName,
              type,
            };
            const treeNode = getFullTreeByParentUid(uid);
            return getDiscourseContextResults(text).then((discourseResults) => {
              const referenceResults = isFlagEnabled("render references")
                ? window.roamAlphaAPI
                    .q(
                      `[:find (pull ?pr [:node/title]) (pull ?r [:block/heading [:block/string :as "text"] [:children/view-type :as "viewType"] {:block/children ...}]) :where [?p :node/title "${normalizePageTitle(
                        text
                      )}"] [?r :block/refs ?p] [?r :block/page ?pr]]`
                    )
                    .filter(([, { children = [] }]) => !!children.length)
                : [];
              const content = `---\n${yamlLines
                .map((s) =>
                  s.replace(/{([^}]+)}/g, (_, capt: string) =>
                    result[capt].toString()
                  )
                )
                .join("\n")}\n---\n\n${treeNode.children
                .map((c) =>
                  toMarkdown({
                    c,
                    v,
                    i: 0,
                    opts: {
                      refs: optsRefs,
                      embeds: optsEmbeds,
                      simplifiedFilename,
                      allNodes,
                      maxFilenameLength,
                      removeSpecialCharacters,
                    },
                  })
                )
                .join("\n")}\n${
                discourseResults.length
                  ? `\n###### Discourse Context\n\n${discourseResults
                      .flatMap((r) =>
                        Object.values(r.results).map(
                          (t) =>
                            `- **${r.label}::** ${toLink(
                              getFilename({
                                title: t.text,
                                maxFilenameLength,
                                simplifiedFilename,
                                allNodes,
                                removeSpecialCharacters,
                              })
                            )}`
                        )
                      )
                      .join("\n")}\n`
                  : ""
              }${
                referenceResults.length
                  ? `\n###### References\n\n${referenceResults
                      .map(
                        (r) =>
                          `${toLink(
                            getFilename({
                              title: r[0].title,
                              maxFilenameLength,
                              simplifiedFilename,
                              allNodes,
                              removeSpecialCharacters,
                            })
                          )}\n\n${toMarkdown({
                            c: r[1],
                            opts: {
                              refs: optsRefs,
                              embeds: optsEmbeds,
                              simplifiedFilename,
                              allNodes,
                              maxFilenameLength,
                              removeSpecialCharacters,
                            },
                          })}`
                      )
                      .join("\n")}\n`
                  : ""
              }`;
              const uids = new Set(collectUids(treeNode));
              return { title: text, content, uids };
            });
          })
        );
        return pages.map(({ title, content }) => ({
          title: getFilename({
            title,
            maxFilenameLength,
            simplifiedFilename,
            allNodes,
            removeSpecialCharacters,
          }),
          content,
        }));
      },
    },
    {
      name: "JSON",
      callback: async ({ filename }) => {
        const data = await getJsonData();
        return [
          {
            title: `${filename.replace(/\.json$/, "")}.json`,
            content: JSON.stringify(data),
          },
        ];
      },
    },
    {
      name: "graph",
      callback: async ({ filename, graph }) => {
        const data = await getJsonData();
        window.roamjs.extension.multiplayer.sendToGraph({
          operation: "IMPORT_DISCOURSE_GRAPH",
          data: {
            ...data,
            title: filename,
          },
          graph,
        });
        return [];
      },
    },
  ];
};

export default getExportTypes;
