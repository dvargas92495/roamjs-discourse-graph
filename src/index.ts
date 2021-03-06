import addStyle from "roamjs-components/dom/addStyle";
import createBlock from "roamjs-components/writes/createBlock";
import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getChildrenLengthByPageUid from "roamjs-components/queries/getChildrenLengthByPageUid";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import getPageTitleByHtmlElement from "roamjs-components/dom/getPageTitleByHtmlElement";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import runExtension from "roamjs-components/util/runExtension";
import toConfig from "roamjs-components/util/toConfigPageName";
import updateBlock from "roamjs-components/writes/updateBlock";
import {
  createConfigObserver,
  render as configPageRender,
} from "roamjs-components/components/ConfigPage";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import { render } from "./NodeMenu";
import { render as renderToast } from "roamjs-components/components/Toast";
import { render as renderAlert } from "roamjs-components/components/SimpleAlert";
import { render as exportRender } from "./ExportDialog";
import { render as importRender } from "./ImportDialog";
import { render as queryRender } from "./QueryDrawer";
import { render as contextRender } from "./DiscourseContext";
import { render as discourseOverlayRender } from "./components/DiscourseContextOverlay";
import { render as renderSavedQueryPage } from "./components/SavedQueryPage";
import {
  initializeDataWorker,
  listeners,
  shutdownDataWorker,
} from "./dataWorkerClient";
import { render as cyRender } from "./CytoscapePlayground";
import { render as overviewRender } from "./components/DiscourseGraphOverview";
import { render as previewRender } from "./LivePreview";
import { render as notificationRender } from "./NotificationIcon";
import { render as queryRequestRender } from "./components/SendQueryRequest";
import { render as renderBlockFeed } from "./components/BlockFeed";
import {
  DEFAULT_NODE_VALUES,
  DEFAULT_RELATION_VALUES,
  getDiscourseContextResults,
  getNodeReferenceChildren,
  getNodes,
  getPageMetadata,
  getQueriesUid,
  getRelations,
  getSubscribedBlocks,
  getUserIdentifier,
  isFlagEnabled,
  isNodeTitle,
  matchNode,
} from "./util";
import refreshConfigTree from "./utils/refreshConfigTree";
import { NodeConfigPanel, RelationConfigPanel } from "./ConfigPanels";
import SubscriptionConfigPanel from "./SubscriptionConfigPanel";
import ReactDOM from "react-dom";
import importDiscourseGraph from "./utils/importDiscourseGraph";
import getSubTree from "roamjs-components/util/getSubTree";
import { Intent } from "@blueprintjs/core";
import createButtonObserver from "roamjs-components/dom/createButtonObserver";
import getUidsFromButton from "roamjs-components/dom/getUidsFromButton";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import createPage from "roamjs-components/writes/createPage";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import React from "react";
import NodeIndex from "./components/NodeIndex";
import addScriptAsDependency from "roamjs-components/dom/addScriptAsDependency";
import registerDatalogTranslators from "./utils/registerDatalogTranslators";
import NodeAttributes from "./components/NodeAttributes";
import deriveNodeAttribute from "./utils/deriveNodeAttribute";
import type { DatalogClause } from "roamjs-components/types/native";
import TextPanel from "roamjs-components/components/ConfigPanels/TextPanel";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import CustomPanel from "roamjs-components/components/ConfigPanels/CustomPanel";
import NumberPanel from "roamjs-components/components/ConfigPanels/NumberPanel";
import MultiTextPanel from "roamjs-components/components/ConfigPanels/MultiTextPanel";
import SelectPanel from "roamjs-components/components/ConfigPanels/SelectPanel";
import BlocksPanel from "roamjs-components/components/ConfigPanels/BlocksPanel";
import type {
  CustomField,
  Field,
  SelectField,
  FlagField,
} from "roamjs-components/components/ConfigPanels/types";
import { render as versioning } from "roamjs-components/components/VersionSwitcher";
import fireWorkerQuery, { FireQuery } from "./utils/fireWorkerQuery";
import registerExperimentalMode from "roamjs-components/util/registerExperimentalMode";
import NodeSpecification from "./components/NodeSpecification";

addStyle(`.roamjs-discourse-live-preview>div>div>.rm-block-main,
.roamjs-discourse-live-preview>div>div>.rm-inline-references,
.roamjs-discourse-live-preview>div>div>.rm-block-children>.rm-multibar {
  display: none;
}

.roamjs-discourse-live-preview>div>div>.rm-block-children {
  margin-left: -4px;
}

.roamjs-discourse-live-preview {
  overflow-y: scroll;
}

.roamjs-discourse-context-title { 
  font-size: 16px;
  color: #106ba3;
  cursor: pointer; 
}

.roamjs-discourse-context-title:hover { 
  text-decoration: underline;
}

.roamjs-discourse-config-format {
  flex-grow: 1;
  padding-right: 8px;
}

.roamjs-discourse-edit-relations {
  border: 1px solid gray;
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
  height: 400px;
  width: 100%;
  position: relative;
}

.roamjs-discourse-edit-relations > div:focus {
  outline: none;
}

.roamjs-discourse-drawer > .bp3-overlay,
.roamjs-discourse-notification-drawer > .bp3-overlay {
  pointer-events: none;
}

div.roamjs-discourse-drawer div.bp3-drawer,
div.roamjs-discourse-notification-drawer div.bp3-drawer {
  pointer-events: all;
  width: 40%;
}

.roamjs-discourse-notification-drawer .roamjs-discourse-notification-uid:hover {
  text-decoration: underline;
}

.roamjs-discourse-notification-drawer .roamjs-discourse-notification-uid {
  cursor: pointer; 
  color: #106BA3;
}

.roamjs-discourse-notification-drawer .bp3-drawer {
  max-width: 400px;
}

.roam-main {
  position: relative;
}

.roamjs-discourse-condition-source, 
.roamjs-discourse-condition-relation,
.roamjs-discourse-return-node,
.roamjs-discourse-return-wrapper {
  min-width: 144px;
  max-width: 144px;
}

.roamjs-discourse-condition-relation,
.roamjs-discourse-return-wrapper {
  padding-right: 8px;
}

.roamjs-discourse-condition-target { 
  flex-grow: 1; 
  display: flex; 
  min-width: 300px;
}

.roamjs-discourse-condition-relation .bp3-popover-target,
.roamjs-discourse-condition-target .roamjs-page-input-target { 
  width: 100%
}

.roamjs-discourse-results-sort button {
  font-size: 10px;
  padding: 0 4px;
}

.roamjs-discourse-results-sort button,
.roamjs-discourse-results-sort .bp3-menu {
  font-size: 10px;
  padding: 0 4px;
  width: 88px;
  max-width: 88px;
  min-width: 88px;
}

.roamjs-discourse-results-sort .bp3-button-text {
  margin-right: 2;
}

.roamjs-discourse-hightlighted-result {
  background: #FFFF00;
}

.roamjs-discourse-editor-preview > .roam-block-container > .rm-block-main,
.roamjs-discourse-editor-preview > .roam-block-container > .rm-block-children > .rm-multibar,
.roamjs-discourse-editor-preview > .roam-block-container > .rm-block-children > .roam-block-container > .rm-block-main > .controls,
.roamjs-discourse-editor-preview > .roam-block-container > .rm-block-children > .roam-block-container > .rm-block-children > .rm-multibar {
  visibility: hidden;
}

.roamjs-discourse-editor-preview {
  margin-left: -32px;
  margin-top: -8px;
}

.roamjs-discourse-editor-preview 
  > .roam-block-container 
  > .rm-block-children 
  > .roam-block-container 
  > .rm-block-main {
  font-size: 24px;
  font-weight: 700;
}

.roamjs-discourse-editor-preview .rm-block-main {
  pointer-events: none;
}

.roamjs-connected-ref > div {
  display: none;
}

.roamjs-discourse-result-panel {
  width: 100%;
}

.roamjs-attribute-value {
  flex-grow: 1; 
  margin: 0 16px;
}

.roamjs-discourse-results-view ul::-webkit-scrollbar {
  width: 6px;
}

.roamjs-discourse-results-view ul::-webkit-scrollbar-thumb {
  background: #888;
}

.roamjs-discourse-playground-dialog .bp3-popover-wrapper,
.roamjs-discourse-playground-dialog .roamjs-autocomplete-input-target,
.roamjs-discourse-playground-dialog textarea,
.roamjs-discourse-playground-dialog input {
  display: inline-block;
  width: 100%;
}

.roamjs-discourse-playground-dialog textarea {
  min-height: 96px;
}`);

const CONFIG = toConfig("discourse-graph");
const user = getUserIdentifier();

const pageRefObservers = new Set<(s: HTMLSpanElement) => void>();
const previewPageRefHandler = (s: HTMLSpanElement) => {
  const tag =
    s.getAttribute("data-tag") ||
    s.parentElement.getAttribute("data-link-title");
  if (!s.getAttribute("data-roamjs-discourse-augment-tag")) {
    s.setAttribute("data-roamjs-discourse-augment-tag", "true");
    const parent = document.createElement("span");
    previewRender({
      parent,
      tag,
      registerMouseEvents: ({ open, close }) => {
        s.addEventListener("mouseenter", (e) => open(e.ctrlKey));
        s.addEventListener("mouseleave", close);
      },
    });
    s.appendChild(parent);
  }
};

const overlayPageRefHandler = (s: HTMLSpanElement) => {
  if (s.parentElement && !s.parentElement.closest(".rm-page-ref")) {
    const tag =
      s.getAttribute("data-tag") ||
      s.parentElement.getAttribute("data-link-title");
    if (!s.getAttribute("data-roamjs-discourse-overlay") && isNodeTitle(tag)) {
      s.setAttribute("data-roamjs-discourse-overlay", "true");
      const parent = document.createElement("span");
      discourseOverlayRender({
        parent,
        tag: tag.replace(/\\"/g, '"'),
      });
      if (s.hasAttribute("data-tag")) {
        s.appendChild(parent);
      } else {
        s.parentElement.appendChild(parent);
      }
    }
  }
};

const pageRefObserverRef: { current?: MutationObserver } = {
  current: undefined,
};
const enablePageRefObserver = () =>
  (pageRefObserverRef.current = createHTMLObserver({
    useBody: true,
    tag: "SPAN",
    className: "rm-page-ref",
    callback: (s: HTMLSpanElement) => {
      pageRefObservers.forEach((f) => f(s));
    },
  }));
const disablePageRefObserver = () => {
  pageRefObserverRef.current.disconnect();
  pageRefObserverRef.current = undefined;
};
const onPageRefObserverChange =
  (handler: (s: HTMLSpanElement) => void) => (b: boolean) => {
    if (b) {
      if (!pageRefObservers.size) enablePageRefObserver();
      pageRefObservers.add(handler);
    } else {
      pageRefObservers.delete(handler);
      if (!pageRefObservers.size) disablePageRefObserver();
    }
  };

runExtension("discourse-graph", async () => {
  const { pageUid } = await createConfigObserver({
    title: CONFIG,
    config: {
      tabs: [
        {
          id: "home",
          fields: [
            {
              title: "trigger",
              description:
                "The trigger to create the node menu. Must refresh after editing.",
              defaultValue: "\\",
              Panel: TextPanel,
            },
            {
              title: "hide page metadata",
              description:
                "Whether or not to display the page author and created date under each title",
              Panel: FlagPanel,
            },
            {
              title: "preview",
              description:
                "Whether or not to display page previews when hovering over page refs",
              Panel: FlagPanel,
              options: {
                onChange: onPageRefObserverChange(previewPageRefHandler),
              },
            } as Field<FlagField>,
          ],
        },
        {
          id: "grammar",
          fields: [
            {
              title: "nodes",
              Panel: CustomPanel,
              description: "The types of nodes in your discourse graph",
              options: {
                component: NodeConfigPanel,
              },
            } as Field<CustomField>,
            {
              title: "relations",
              Panel: CustomPanel,
              description: "The types of relations in your discourse graph",
              defaultValue: DEFAULT_RELATION_VALUES,
              options: {
                component: RelationConfigPanel,
              },
            } as Field<CustomField>,
            {
              title: "overlay",
              Panel: FlagPanel,
              description:
                "Whether to overlay discourse context information over node references",
              options: {
                onChange: (val) => {
                  onPageRefObserverChange(overlayPageRefHandler)(val);
                },
              },
            } as Field<FlagField>,
          ],
        },
        {
          id: "subscriptions",
          fields: [
            {
              title: user,
              Panel: CustomPanel,
              description:
                "Subscription User Settings to notify you of latest changes",
              options: {
                component: SubscriptionConfigPanel,
              },
            } as Field<CustomField>,
            {
              title: "multiplayer",
              Panel: FlagPanel,
              description: "Whether or not to enable Multiplayer on this graph",
              options: {
                onChange: (f) =>
                  f
                    ? window.roamjs.extension.multiplayer.enable()
                    : window.roamjs.extension.multiplayer.disable(),
              },
            } as Field<FlagField>,
          ],
        },
        { id: "render references", fields: [], toggleable: true },
        {
          id: "export",
          fields: [
            {
              title: "max filename length",
              Panel: NumberPanel,
              description:
                "Set the maximum name length for markdown file exports",
              defaultValue: 64,
            },
            {
              title: "remove special characters",
              Panel: FlagPanel,
              description:
                "Whether or not to remove the special characters in a file name",
            },
            {
              title: "simplified filename",
              Panel: FlagPanel,
              description:
                "For discourse nodes, extract out the {content} from the page name to become the file name",
            },
            {
              title: "frontmatter",
              Panel: MultiTextPanel,
              description:
                "Specify all the lines that should go to the Frontmatter of the markdown file",
            },
            {
              title: "resolve block references",
              Panel: FlagPanel,
              description:
                "Replaces block references in the markdown content with the block's content",
            },
            {
              title: "resolve block embeds",
              Panel: FlagPanel,
              description:
                "Replaces block embeds in the markdown content with the block's content tree",
            },
            {
              title: "link type",
              Panel: SelectPanel,
              description: "How to format links that appear in your export",
              options: {
                items: ["alias", "wikilinks"],
              },
            } as Field<SelectField>,
          ],
        },
      ],
      versioning,
    },
  });

  let fireQueryRef: FireQuery;
  registerExperimentalMode({
    feature: "Cached Graph",
    onEnable: () => {
      initializeDataWorker(pageUid).then((worker) => {
        const swapFireQuery = () => {
          fireQueryRef = window.roamjs.extension.queryBuilder.fireQuery;
          window.roamjs.extension.queryBuilder.fireQuery = async (args) => {
            // @ts-ignore temporary
            const { getDatalogQueryComponents } =
              window.roamjs.extension.queryBuilder;
            const { where, definedSelections } = (
              getDatalogQueryComponents as (args: Parameters<FireQuery>[0]) => {
                where: DatalogClause[];
                definedSelections: {
                  pull: string;
                  label: string;
                  key: string;
                }[];
              }
            )(args);
            const pull = definedSelections
              .flatMap((sel) => {
                const pullExec = /\(pull \?([^\s]+) \[([^\]]+)\]\)/.exec(
                  sel.pull
                );
                if (!pullExec || pullExec.length < 3) return [];
                const [_, _var, fields] = pullExec;
                return fields.split(/\s+/).map((field) => ({
                  label: field.endsWith("uid") ? `${sel.label}-uid` : sel.label,
                  field,
                  _var,
                }));
              })
              .filter((s) => !!s);
            return fireWorkerQuery({ where, pull, worker });
          };
        };
        if (window.roamjs.extension.queryBuilder) {
          swapFireQuery();
        } else {
          document.body.addEventListener(
            "roamjs:discourse-graph:query-builder",
            swapFireQuery,
            { once: true }
          );
        }
      });
    },
    onDisable: () => {
      if (fireQueryRef)
        window.roamjs.extension.queryBuilder.fireQuery = fireQueryRef;
      shutdownDataWorker();
    },
  });

  const configTree = getBasicTreeByParentUid(pageUid);
  const grammarTree = getSubTree({ tree: configTree, key: "grammar" }).children;
  const nodeTree = getSubTree({ tree: grammarTree, key: "nodes" }).children;
  if (nodeTree.length) {
    await new Promise((resolve) =>
      renderAlert({
        content: `As part of improving the flexibility of Discourse Graph Nodes, we are migrating the nodes stored as blocks in your roam/js/discourse-graph page to be stored as pages prefixed with discourse-graph/nodes/*.

We expect that there will be no disruption in functionality. If you see issues after hitting confirm, please try refreshing. If issues persist, please reach out to support@roamjs.com.`,
        onConfirm: () => {
          Promise.all(
            nodeTree.map((n) => {
              const nodeFormat = n.text;
              const nodeName = n.children[0]?.text || "";
              const nodeShortcut = n.children[1]?.text || "";
              const formatTree = getBasicTreeByParentUid(
                getPageUidByPageTitle(nodeFormat)
              );
              const templateUid = window.roamAlphaAPI.util.generateUID();
              return deleteBlock(n.uid)
                .then(() =>
                  createPage({
                    title: `discourse-graph/nodes/${nodeName}`,
                    tree: [
                      { text: "Format", children: [{ text: nodeFormat }] },
                      { text: "Shortcut", children: [{ text: nodeShortcut }] },
                      { text: "Template", uid: templateUid },
                    ],
                    uid: n.uid,
                  })
                )
                .then(() =>
                  Promise.all(
                    formatTree.map((node, order) =>
                      window.roamAlphaAPI.moveBlock({
                        location: {
                          "parent-uid": templateUid,
                          order,
                        },
                        block: { uid: node.uid },
                      })
                    )
                  )
                );
            })
          ).then(resolve);
        },
      })
    );
  }
  refreshConfigTree();
  if (getNodes().length === 0) {
    await Promise.all(
      DEFAULT_NODE_VALUES.map((n) =>
        createPage({
          title: `discourse-graph/nodes/${n.text}`,
          uid: n.type,
          tree: [
            { text: "Format", children: [{ text: n.format }] },
            { text: "Shortcut", children: [{ text: n.shortcut }] },
          ],
        })
      )
    ).then(refreshConfigTree);
  }

  document.body.addEventListener(
    "roamjs:query-builder:loaded",
    () => {
      registerDatalogTranslators();

      const { registerSelection } = window.roamjs.extension.queryBuilder;
      registerSelection({
        test: /^(.*)-(.*)$/,
        pull: ({ returnNode }) => `(pull ?${returnNode} [:node/title])`,
        mapper: () => {
          return `This selection is deprecated. Define a Node Attribute and use \`discourse:attribute\` instead.`;
        },
      });

      registerSelection({
        test: /^discourse:(.*)$/,
        pull: ({ returnNode }) => `(pull ?${returnNode} [:node/title])`,
        mapper: (r, key) => {
          const attribute = key.substring("discourse:".length);
          const title = r[":node/title"] || "";
          return deriveNodeAttribute({ title, attribute });
        },
      });

      registerSelection({
        test: /^\s*type\s*$/i,
        pull: ({ returnNode }) =>
          `(pull ?${returnNode} [:node/title :block/string])`,
        mapper: (r) => {
          const title = r[":node/title"] || "";
          return (
            getNodes().find((n) => matchNode({ format: n.format, title }))
              ?.text || (r[":block/string"] ? "block" : "page")
          );
        },
      });

      document.body.dispatchEvent(
        new Event("roamjs:discourse-graph:query-builder")
      );
    },
    { once: true }
  );
  document.body.addEventListener(
    "roamjs:multiplayer:loaded",
    () => {
      const isEnabled = getSubTree({
        tree: configTree,
        key: "subscriptions",
      }).children.some((s) => toFlexRegex("multiplayer").test(s.text));
      if (isEnabled) {
        window.roamjs.extension.multiplayer.enable();
        window.roamjs.extension.multiplayer.addGraphListener({
          operation: "IMPORT_DISCOURSE_GRAPH",
          handler: (
            data: Parameters<typeof importDiscourseGraph>[0],
            graph
          ) => {
            importDiscourseGraph(data);
            const todayUid = window.roamAlphaAPI.util.dateToPageUid(new Date());
            const todayOrder = getChildrenLengthByPageUid(todayUid);
            createBlock({
              parentUid: todayUid,
              order: todayOrder,
              node: {
                text: `Imported discourse graph from [[${graph}]]`,
                children: [{ text: `[[${data.title}]]` }],
              },
            });
            window.roamjs.extension.multiplayer.sendToGraph({
              operation: "IMPORT_DISCOURSE_GRAPH_CONFIRM",
              graph,
            });
          },
        });
        window.roamjs.extension.multiplayer.addGraphListener({
          operation: "IMPORT_DISCOURSE_GRAPH_CONFIRM",
          handler: (_, graph) =>
            renderToast({
              id: "import-p2p-success",
              content: `${graph} successfully imported your discourse graph!`,
            }),
        });
        window.roamjs.extension.multiplayer.addGraphListener({
          operation: "QUERY_REQUEST",
          handler: (json, graph) => {
            const { page, requestId } = json as {
              page: string;
              requestId: string;
            };
            const todayUid = window.roamAlphaAPI.util.dateToPageUid(new Date());
            const bottom = getChildrenLengthByPageUid(todayUid);
            createBlock({
              parentUid: todayUid,
              order: bottom,
              node: {
                text: `New [[query request]] from [[${graph}]]`,
                children: [
                  {
                    text: `Get full page contents of [[${page}]]`,
                  },
                  {
                    text: `{{Accept:${graph}:${requestId}:${page}}}`,
                  },
                ],
              },
            });
            renderToast({
              id: "new-query-request",
              content: `New query request from ${graph}`,
              intent: Intent.PRIMARY,
            });
            window.roamjs.extension.multiplayer.sendToGraph({
              operation: "QUERY_REQUEST_RECEIVED",
              graph,
            });
          },
        });
      }
    },
    { once: true }
  );
  if (window.roamjs.loaded.has("query-builder")) {
    console.warn(`It appears that you have the Query Builder extension installed as well as Discourse Graph.
    
    This is not necessary, as the Discourse Graph extension already comes preloaded with its own copy of Query Builder by default. Please remove the Query Builder extension as this redundancy could cause unforseen issues`);
  }
  if (process.env.NODE_ENV === "development") {
    addScriptAsDependency({
      id: "roamjs-query-builder-main",
      //src: "http://localhost:3100/main.js",
      src: `https://roamjs.com/query-builder/2022-07-21-15-08/main.js`,
      dataAttributes: { source: "discourse-graph" },
    });
    addScriptAsDependency({
      id: "roamjs-multiplayer-main",
      src: "http://localhost:3200/main.js",
      ///src: "https://roamjs.com/multiplayer/2022-07-20-22-05/main.js",
      dataAttributes: { source: "discourse-graph" },
    });
  } else {
    addScriptAsDependency({
      id: "roamjs-query-builder",
      src: `https://roamjs.com/query-builder/2022-07-21-15-08/main.js`,
      dataAttributes: { source: "discourse-graph" },
    });
    addScriptAsDependency({
      id: "roamjs-multiplayer",
      src: "https://roamjs.com/multiplayer/2022-07-20-22-05/main.js",
      dataAttributes: { source: "discourse-graph" },
    });
  }

  const trigger = getSettingValueFromTree({
    tree: configTree,
    key: "trigger",
    defaultValue: "\\",
  }).trim();
  document.addEventListener("keydown", (e) => {
    if (e.key === trigger) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "TEXTAREA" &&
        target.classList.contains("rm-block-input")
      ) {
        render({ textarea: target as HTMLTextAreaElement });
        e.preventDefault();
        e.stopPropagation();
      }
    }
  });

  window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: "Export Discourse Graph",
    callback: () => exportRender({}),
  });

  window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: "Import Discourse Graph",
    callback: () => importRender({}),
  });

  window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: "Send Query Request",
    callback: () => {
      const graphs = window.roamjs.extension.multiplayer.getConnectedGraphs();
      if (!graphs.length) {
        renderToast({
          id: "discouse-no-graphs",
          content: "There are no connected graphs available to ask for a query",
          intent: Intent.WARNING,
        });
      } else {
        queryRequestRender({
          uid: window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"],
          graphs,
        });
      }
    },
  });
  createButtonObserver({
    attribute: "accept",
    render: (b) => {
      b.onclick = () => {
        const { blockUid } = getUidsFromButton(b);
        const text = getTextByBlockUid(blockUid);
        const parts = (/{{([^}]+)}}/.exec(text)?.[1] || "").split(":");
        if (parts.length >= 4) {
          const [, graph, requestId, ...page] = parts;
          const title = page.join(":");
          const uid = getPageUidByPageTitle(title);
          const tree = getFullTreeByParentUid(uid).children;
          window.roamjs.extension.multiplayer.sendToGraph({
            graph,
            operation: `QUERY_RESPONSE/${requestId}`,
            data: {
              page: {
                tree,
                title,
                uid,
              },
            },
          });
          const operation = `QUERY_RESPONSE_RECEIVED/${requestId}`;
          window.roamjs.extension.multiplayer.addGraphListener({
            operation,
            handler: (_, g) => {
              if (g === graph) {
                renderToast({
                  id: "query-response-success",
                  content: `Graph ${g} Successfully Received the query`,
                  intent: Intent.SUCCESS,
                });
                window.roamjs.extension.multiplayer.removeGraphListener({
                  operation,
                });
                updateBlock({ uid: blockUid, text: "Sent" });
              }
            },
          });
        }
      };
    },
  });

  const elToTitle = (e: Node): string => {
    if (e.nodeName === "#text") {
      return e.nodeValue;
    } else if (
      e.nodeName === "SPAN" &&
      (e as HTMLSpanElement).classList.contains("rm-page-ref__brackets")
    ) {
      return "";
    } else if (
      e.nodeName === "SPAN" &&
      (e as HTMLSpanElement).classList.contains("rm-page-ref")
    ) {
      return `[[${Array.from(e.childNodes).map(elToTitle).join("")}]]`;
    } else {
      return Array.from(e.childNodes).map(elToTitle).join("");
    }
  };

  const globalRefs: { [key: string]: (...args: string[]) => void } = {
    clearOnClick: () => {},
  };

  const hidePageMetadata = configTree.some((t) =>
    toFlexRegex("hide page metadata").test(t.text)
  );
  createHTMLObserver({
    tag: "H1",
    className: "rm-title-display",
    callback: (h1: HTMLHeadingElement) => {
      const title = elToTitle(h1);
      if (!hidePageMetadata) {
        const { displayName, date } = getPageMetadata(title);
        const container = document.createElement("div");
        const oldMarginBottom = getComputedStyle(h1).marginBottom;
        container.style.marginTop = `${
          4 - Number(oldMarginBottom.replace("px", "")) / 2
        }px`;
        container.style.marginBottom = oldMarginBottom;
        const label = document.createElement("i");
        label.innerText = `Created by ${
          displayName || "Anonymous"
        } on ${date.toLocaleString()}`;
        container.appendChild(label);
        if (h1.parentElement.lastChild === h1) {
          h1.parentElement.appendChild(container);
        } else {
          h1.parentElement.insertBefore(container, h1.nextSibling);
        }
      }
      if (title.startsWith("Playground") && !!h1.closest(".roam-article")) {
        const children = document.querySelector<HTMLDivElement>(
          ".roam-article .rm-block-children"
        );
        if (!children.hasAttribute("data-roamjs-discourse-playground")) {
          children.setAttribute("data-roamjs-discourse-playground", "true");
          const parent = document.createElement("div");
          children.parentElement.appendChild(parent);
          parent.style.height = "500px";
          cyRender({
            parent,
            title,
            previewEnabled: isFlagEnabled("preview"),
            globalRefs,
          });
        }
      } else if (title === "Discourse Graph Overview") {
        const children = document.querySelector<HTMLDivElement>(
          ".roam-article .rm-block-children"
        );
        if (!children.hasAttribute("data-roamjs-discourse-overview")) {
          children.setAttribute("data-roamjs-discourse-overview", "true");
          children.style.display = "none";
          const p = document.createElement("div");
          children.parentElement.appendChild(p);
          p.style.height = "500px";
          overviewRender({
            parent: p,
            pageUid: getPageTitleByPageUid(title),
          });
        }
      } else if (title.startsWith("discourse-graph/nodes/")) {
        const nodeText = title.substring("discourse-graph/nodes/".length);
        const allNodes = getNodes();
        const node = allNodes.find(({ text }) => text === nodeText);
        if (node) {
          const renderNode = () =>
            configPageRender({
              h: h1,
              title,
              config: [
                {
                  title: "Index",
                  description:
                    "Index of all of the pages in your graph of this type",
                  Panel: CustomPanel,
                  options: {
                    component: ({ uid }) =>
                      React.createElement(NodeIndex, {
                        node,
                        parentUid: uid,
                      }),
                  },
                } as Field<CustomField>,
                {
                  title: "Format",
                  description: `The format ${nodeText} pages should have.`,
                  defaultValue: "\\",
                  Panel: TextPanel,
                },
                // {
                //   title: "Specification",
                //   description: `The conditions specified to identify a ${nodeText} node.`,
                //   Panel: CustomPanel,
                //   options: {
                //     component: ({ uid }) =>
                //       React.createElement(NodeSpecification, {
                //         node,
                //         parentUid: uid,
                //       }),
                //   },
                // } as Field<CustomField>,
                {
                  title: "Shortcut",
                  description: `The trigger to quickly create a ${nodeText} page from the node menu.`,
                  defaultValue: "\\",
                  Panel: TextPanel,
                },
                {
                  title: "Description",
                  description: `Describing what the ${nodeText} node represents in your graph.`,
                  Panel: TextPanel,
                },
                {
                  title: "Template",
                  description: `The template that auto fills ${nodeText} page when generated.`,
                  Panel: BlocksPanel,
                },
                {
                  title: "Attributes",
                  description: `A set of derived properties about the node based on queryable data.`,
                  Panel: CustomPanel,
                  options: {
                    component: NodeAttributes,
                  },
                } as Field<CustomField>,
                {
                  title: "Overlay",
                  description: `Select which attribute is used for the Discourse Overlay`,
                  Panel: SelectPanel,
                  options: {
                    items: () =>
                      getSubTree({
                        parentUid: getCurrentPageUid(),
                        key: "Attributes",
                      }).children.map((c) => c.text),
                  },
                } as Field<SelectField>,
              ],
            });

          if (window.roamjs.extension.queryBuilder) {
            renderNode();
          } else {
            document.body.addEventListener(
              "roamjs:discourse-graph:query-builder",
              renderNode,
              { once: true }
            );
          }
        }
      } else if (title.startsWith("discourse-graph/queries/")) {
        // in order to deprecate this branch we need to do two things:
        // - add `discourse-graph/queries` as a prefix to qb config
        // - ensure that query pages could still get DG export types
        const uid = getPageUidByPageTitle(title);
        const attribute = `data-roamjs-${uid}`;
        const containerParent = h1.parentElement?.parentElement;
        if (containerParent && !containerParent.hasAttribute(attribute)) {
          containerParent.setAttribute(attribute, "true");
          const parent = document.createElement("div");
          const configPageId = title.split("/").slice(-1)[0];
          parent.id = `${configPageId}-config`;
          containerParent.insertBefore(
            parent,
            h1.parentElement?.nextElementSibling || null
          );
          renderSavedQueryPage({
            pageUid: uid,
            parent,
          });
        }
      }
    },
  });

  const clearOnClick = (tag: string) => {
    const uid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"] || "";
    const text = `[[${tag}]]`;
    if (uid) {
      const currentText = getTextByBlockUid(uid);
      setTimeout(
        () =>
          updateBlock({
            text: `${currentText} ${text}`,
            uid,
          }),
        1
      );
    } else {
      const parentUid = getCurrentPageUid();
      const pageTitle = getPageTitleByPageUid(parentUid);
      if (pageTitle.startsWith("Playground")) {
        globalRefs.clearOnClick(tag);
      } else {
        const order = getChildrenLengthByPageUid(parentUid);
        createBlock({ parentUid, node: { text }, order });
      }
    }
  };

  window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: "Open Query Drawer",
    callback: () =>
      getQueriesUid().then((blockUid) =>
        queryRender({
          blockUid,
          clearOnClick,
        })
      ),
  });

  createHTMLObserver({
    tag: "DIV",
    className: "rm-reference-main",
    callback: (d: HTMLDivElement) => {
      const title = elToTitle(getPageTitleByHtmlElement(d));
      if (
        isNodeTitle(title) &&
        !d.getAttribute("data-roamjs-discourse-context")
      ) {
        d.setAttribute("data-roamjs-discourse-context", "true");
        const parent =
          d.querySelector("div.rm-reference-container") ||
          d.children[0]?.children[0];
        if (parent) {
          const p = document.createElement("div");
          parent.parentElement.insertBefore(p, parent);
          contextRender({
            parent: p,
            title: elToTitle(getPageTitleByHtmlElement(d)),
          });
        }
      }
    },
  });
  setTimeout(() => {
    if (isFlagEnabled("render references")) {
      createHTMLObserver({
        className: "rm-sidebar-window",
        tag: "div",
        callback: (d) => {
          const label = d.querySelector<HTMLSpanElement>(
            ".window-headers div span"
          );
          if (label && label.innerText.startsWith("Outline")) {
            const title = elToTitle(
              d.querySelector<HTMLHeadingElement>(".rm-title-display")
            );
            if (isNodeTitle(title)) {
              const container = getNodeReferenceChildren(title);
              d.appendChild(container);
            }
          }
        },
      });
    }
  }, 1);

  setTimeout(() => {
    if (isFlagEnabled("preview")) pageRefObservers.add(previewPageRefHandler);
    if (isFlagEnabled("grammar.overlay")) {
      pageRefObservers.add(overlayPageRefHandler);
    }
    if (pageRefObservers.size) enablePageRefObserver();
  }, 1);

  const showNotificationIcon = (url: string) => {
    const subscribedBlocks = getSubscribedBlocks();
    const subscribedUids = new Set(
      subscribedBlocks.map((t) => t.children[0]?.children?.[0]?.text)
    );
    const uid = url.match(/\/page\/(.*)$/)?.[1] || "";
    if (uid && subscribedUids.has(uid)) {
      const article = document.querySelector<HTMLDivElement>(".roam-article");
      const articleStyle = getComputedStyle(article);
      const span = document.createElement("span");
      span.style.position = "absolute";
      span.style.top = articleStyle.paddingTop;
      span.style.left = articleStyle.paddingLeft;
      span.id = "roamjs-discourse-notification-icon";
      setTimeout(() => {
        article.insertBefore(span, article.firstElementChild);
        const notificationBlock = (
          subscribedBlocks.find((t) => toFlexRegex(user).test(t.text))
            .children || []
        ).find((t) => t.children[0].text === uid);
        const defaultTimestamp = new Date().valueOf();
        (notificationBlock.children[1]?.uid
          ? Promise.resolve(notificationBlock.children[1]?.uid)
          : createBlock({
              node: { text: `${defaultTimestamp}` },
              parentUid: notificationBlock.uid,
              order: 1,
            })
        ).then((configUid) =>
          notificationRender({
            p: span,
            parentUid: uid,
            timestamp:
              Number(notificationBlock.children[1]?.text) || defaultTimestamp,
            configUid,
          })
        );
      }, 1000);
    }
  };

  window.addEventListener("hashchange", (e) => {
    if (
      e.oldURL.endsWith(pageUid) ||
      getNodes().some(({ type }) => e.oldURL.endsWith(type))
    ) {
      refreshConfigTree();
    }
    const oldIcon = document.getElementById(
      "roamjs-discourse-notification-icon"
    );
    if (oldIcon) {
      ReactDOM.unmountComponentAtNode(oldIcon);
      oldIcon.remove();
      refreshConfigTree();
    }
    showNotificationIcon(e.newURL);
  });
  showNotificationIcon(window.location.hash);

  window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: "Open Feed",
    callback: () => renderBlockFeed({}),
  });
});
