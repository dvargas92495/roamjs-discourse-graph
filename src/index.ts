import addStyle from "roamjs-components/dom/addStyle";
import createBlock from "roamjs-components/writes/createBlock";
import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
import createBlockObserver from "roamjs-components/dom/createBlockObserver";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getChildrenLengthByPageUid from "roamjs-components/queries/getChildrenLengthByPageUid";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import getPageTitleByHtmlElement from "roamjs-components/dom/getPageTitleByHtmlElement";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import runExtension from "roamjs-components/util/runExtension";
import toConfig from "roamjs-components/util/toConfigPageName";
import toRoamDateUid from "roamjs-components/date/toRoamDateUid";
import updateBlock from "roamjs-components/writes/updateBlock";
import getBlockUidsReferencingPage from "roamjs-components/queries/getBlockUidsReferencingPage";
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
import {
  getExperimentalOverlayMode,
  render as discourseOverlayRender,
} from "./components/DiscourseContextOverlay";
import { render as renderSavedQueryPage } from "./components/SavedQueryPage";
import { initializeDataWorker, shutdownDataWorker } from "./dataWorkerClient";
import { render as cyRender } from "./CytoscapePlayground";
import { render as overviewRender } from "./components/DiscourseGraphOverview";
import { render as previewRender } from "./LivePreview";
import { render as notificationRender } from "./NotificationIcon";
import { render as queryRequestRender } from "./components/SendQueryRequest";
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
import getUids from "roamjs-components/dom/getUids";
import { InputTextNode, PullBlock } from "roamjs-components/types";
import createPage from "roamjs-components/writes/createPage";
import addRoamJSDependency from "roamjs-components/dom/addRoamJSDependency";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import React from "react";
import NodeIndex from "./components/NodeIndex";
import addScriptAsDependency from "roamjs-components/dom/addScriptAsDependency";
import registerDatalogTranslators from "./utils/registerDatalogTranslators";

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

.bp3-tabs .bp3-tab-list {
  max-width: 128px;
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

/* width */
.roamjs-discourse-results-view ul::-webkit-scrollbar {
  width: 6px;
}

/* Handle */
.roamjs-discourse-results-view ul::-webkit-scrollbar-thumb {
  background: #888;
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
              type: "text",
            },
            {
              title: "hide page metadata",
              description:
                "Whether or not to display the page author and created date under each title",
              type: "flag",
            },
            {
              title: "preview",
              description:
                "Whether or not to display page previews when hovering over page refs",
              type: "flag",
              options: {
                onChange: onPageRefObserverChange(previewPageRefHandler),
              },
            },
          ],
        },
        {
          id: "grammar",
          fields: [
            {
              title: "nodes",
              type: "custom",
              description: "The types of nodes in your discourse graph",
              options: {
                component: NodeConfigPanel,
              },
            },
            {
              title: "relations",
              type: "custom",
              description: "The types of relations in your discourse graph",
              defaultValue: DEFAULT_RELATION_VALUES,
              options: {
                component: RelationConfigPanel,
              },
            },
            {
              title: "overlay",
              type: "flag",
              description:
                "Whether to overlay discourse context information over node references",
              options: {
                onChange: (val) => {
                  if (getExperimentalOverlayMode()) {
                    if (val) initializeDataWorker();
                    else shutdownDataWorker();
                  }
                  onPageRefObserverChange(overlayPageRefHandler)(val);
                },
              },
            },
          ],
        },
        {
          id: "subscriptions",
          fields: [
            {
              title: user,
              type: "custom",
              description:
                "Subscription User Settings to notify you of latest changes",
              options: {
                component: SubscriptionConfigPanel,
              },
            },
            {
              title: "multiplayer",
              type: "flag",
              description: "Whether or not to enable Multiplayer on this graph",
              options: {
                onChange: (f) =>
                  f
                    ? window.roamjs.extension.multiplayer.enable()
                    : window.roamjs.extension.multiplayer.disable(),
              },
            },
          ],
        },
        { id: "render references", fields: [], toggleable: true },
        {
          id: "export",
          fields: [
            {
              title: "max filename length",
              type: "number",
              description:
                "Set the maximum name length for markdown file exports",
              defaultValue: 64,
            },
            {
              title: "simplified filename",
              type: "flag",
              description:
                "For discourse nodes, extract out the {content} from the page name to become the file name",
            },
            {
              title: "frontmatter",
              type: "multitext",
              description:
                "Specify all the lines that should go to the Frontmatter of the markdown file",
            },
            {
              title: "resolve block references",
              type: "flag",
              description:
                "Replaces block references in the markdown content with the block's content",
            },
            {
              title: "resolve block embeds",
              type: "flag",
              description:
                "Replaces block embeds in the markdown content with the block's content tree",
            },
            {
              title: "links footnote",
              type: "flag",
              description:
                "For discourse nodes, extract out the {content} from the page name to become the file name",
            },
          ],
        },
      ],
      versioning: true,
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
        mapper: (r, key) => {
          const match = key.match(/^(.*)-(.*)$/);
          const rel = match?.[1] || "";
          const target = match?.[2] || "";
          const nodes = getNodes();
          const nodeTitleById = Object.fromEntries(
            nodes.map((n) => [n.type, n.text])
          );
          const text = r[":node/title"] || "";
          const results = getDiscourseContextResults(
            text,
            nodes,
            getRelations().filter(
              (r) =>
                (r.complement === rel && target === nodeTitleById[r.source]) ||
                (r.label === rel && target === nodeTitleById[r.destination])
            ),
            true
          );
          return results.length ? Object.keys(results[0]?.results).length : 0;
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
            const todayUid = toRoamDateUid(new Date());
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
            const todayUid = toRoamDateUid();
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
        window.roamjs.extension.multiplayer.addGraphListener({
          operation: "QUERY_REF",
          handler: (e, graph) => {
            const { uid } = e as { uid: string };
            const node = getFullTreeByParentUid(uid);
            window.roamjs.extension.multiplayer.sendToGraph({
              operation: `QUERY_REF_RESPONSE/${uid}`,
              data: {
                found: !!node.text,
                node,
              },
              graph,
            });
          },
        });
      }
    },
    { once: true }
  );
  if (process.env.NODE_ENV === "development") {
    addScriptAsDependency({
      id: "roamjs-query-builder",
      //src: "http://localhost:3100/main.js",
     src: "https://roamjs.com/query-builder/2022-04-06-14-38/main.js",
      dataAttributes: { source: "discourse-graph" },
    });
    addScriptAsDependency({
      id: "roamjs-multiplayer",
      src: "http://localhost:3200/main.js",
      dataAttributes: { source: "discourse-graph" },
    });
  } else {
    addScriptAsDependency({
      id: "roamjs-query-builder",
      src: "https://roamjs.com/query-builder/2022-04-06-14-38/main.js",
      dataAttributes: { source: "discourse-graph" },
    });
    addScriptAsDependency({
      id: "roamjs-multiplayer",
      src: "https://roamjs.com/multiplayer/2022-03-25-17-46/main.js",
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
          children.style.display = "none";
          const p = document.createElement("div");
          children.parentElement.appendChild(p);
          p.style.height = "500px";
          cyRender({
            p,
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
              config: {
                tabs: [
                  {
                    id: "home",
                    fields: [
                      {
                        title: "Index",
                        description:
                          "Index of all of the pages in your graph of this type",
                        type: "custom",
                        options: {
                          component: ({ uid }) =>
                            React.createElement(NodeIndex, {
                              node,
                              parentUid: uid,
                            }),
                        },
                      },
                      {
                        title: "Format",
                        description: `The format ${nodeText} pages should have.`,
                        defaultValue: "\\",
                        type: "text",
                      },
                      {
                        title: "Shortcut",
                        description: `The trigger to quickly create a ${nodeText} page from the node menu.`,
                        defaultValue: "\\",
                        type: "text",
                      },
                      {
                        title: "Description",
                        description: `Describing what the ${nodeText} node represents in your graph.`,
                        type: "text",
                      },
                      {
                        title: "Template",
                        description: `The template that auto fills ${nodeText} page when generated.`,
                        type: "blocks",
                      },
                      {
                        title: "Importance",
                        description: `An importance score calculated for the node, defaulted to the number of discourse relations`,
                        type: "text",
                        defaultValue: "{count:Has Any Relation To:any}"
                      }
                    ],
                  },
                ],
              },
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

  const clearOnClick = (tag: string, nodeType: string) => {
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
        globalRefs.clearOnClick(tag, nodeType);
      } else {
        const order = getChildrenLengthByPageUid(parentUid);
        createBlock({ parentUid, node: { text }, order });
      }
    }
  };

  window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: "Open Query Drawer",
    callback: () =>
      queryRender({
        blockUid: getQueriesUid(),
        clearOnClick,
      }),
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
      if (getExperimentalOverlayMode()) initializeDataWorker();
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

  const multiplayerReferences = Object.fromEntries(
    getBlockUidsReferencingPage("Multiplayer References").flatMap((uid) =>
      getBasicTreeByParentUid(uid).map((c) => [
        c.text,
        c.children[0]?.uid || "",
      ])
    )
  );

  createBlockObserver((block) => {
    const possibleRefs = Array.from(
      block.querySelectorAll(`span.rm-paren, span.rm-block-ref`)
    );
    if (possibleRefs.some((r) => r.classList.contains("rm-paren"))) {
      const text = getTextByBlockUid(getUids(block).blockUid);
      const refRegex = /\(\((.*?)\)\)/g;
      possibleRefs.forEach((pr) => {
        const uid = refRegex.exec(text)?.[1];
        if (pr.classList.contains("rm-paren")) {
          const renderConnectedReference = () => {
            const refUid = multiplayerReferences[uid];
            const spacer = pr.querySelector<HTMLSpanElement>("span.rm-spacer");
            if (spacer) {
              spacer.style.display = "none";
            }
            pr.classList.remove("rm-paren");
            pr.classList.remove("rm-paren--closed");
            pr.classList.add("rm-block-ref");
            const el = document.createElement("span");
            el.className = "roamjs-connected-ref";
            pr.appendChild(el);
            window.roamAlphaAPI.ui.components.renderBlock({ uid: refUid, el });
            const spanContent = el.querySelector(
              `div.roam-block[id$='${refUid}'] > span`
            );
            el.innerHTML = `${el.innerHTML}${spanContent.innerHTML}`;
          };
          if (multiplayerReferences[uid]) {
            renderConnectedReference();
          } else {
            const operation = `QUERY_REF_RESPONSE/${uid}`;
            window.roamjs.extension.multiplayer.addGraphListener({
              operation,
              handler: (e, graph) => {
                window.roamjs.extension.multiplayer.removeGraphListener({
                  operation,
                });
                const { found, node } = e as {
                  found: boolean;
                  node: InputTextNode;
                };
                const { uid: nodeUid, ...nodeRest } = node;
                if (found) {
                  const newNode = {
                    ...nodeRest,
                    uid: window.roamAlphaAPI.util.generateUID(),
                  };
                  const pageUid = getPageUidByPageTitle(graph);
                  const entry = {
                    text: uid,
                    children: [newNode],
                  };
                  if (!pageUid) {
                    createPage({
                      title: graph,
                      tree: [
                        {
                          text: "[[Multiplayer References]]",
                          children: [entry],
                        },
                      ],
                    });
                  } else {
                    const tree = getBasicTreeByParentUid(pageUid);
                    const referencesUid = tree.find(
                      (t) => t.text === "[[Multiplayer References]]"
                    )?.uid;
                    if (!referencesUid) {
                      createBlock({
                        parentUid: pageUid,
                        node: {
                          text: "[[Multiplayer References]]",
                          children: [entry],
                        },
                      });
                    } else {
                      createBlock({
                        parentUid: referencesUid,
                        node: entry,
                      });
                    }
                  }
                  setTimeout(() => {
                    multiplayerReferences[nodeUid] = newNode.uid;
                    renderConnectedReference();
                  }, 1);
                }
              },
            });
            window.roamjs.extension.multiplayer
              .getConnectedGraphs()
              .forEach((graph) =>
                window.roamjs.extension.multiplayer.sendToGraph({
                  operation: "QUERY_REF",
                  graph,
                  data: { uid },
                })
              );
          }
        }
      });
    }
  });
});
