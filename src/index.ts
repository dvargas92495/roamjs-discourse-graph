import {
  addStyle,
  createBlock,
  createHTMLObserver,
  getBasicTreeByParentUid,
  getChildrenLengthByPageUid,
  getCurrentPageUid,
  getPageTitleByHtmlElement,
  getPageTitleByPageUid,
  getTextByBlockUid,
  runExtension,
  toConfig,
  updateBlock,
} from "roam-client";
import {
  createConfigObserver,
  getSettingValueFromTree,
  getSubTree,
  toFlexRegex,
} from "roamjs-components";
import { render } from "./NodeMenu";
import { render as exportRender } from "./ExportDialog";
import { render as importRender } from "./ImportDialog";
import { render as queryRender } from "./QueryDrawer";
import { render as contextRender } from "./DiscourseContext";
import { render as cyRender } from "./CytoscapePlayground";
import { render as previewRender } from "./LivePreview";
import { render as notificationRender } from "./NotificationIcon";
import {
  DEFAULT_NODE_VALUES,
  DEFAULT_RELATION_VALUES,
  getNodeReferenceChildren,
  getPageMetadata,
  getQueriesUid,
  getQueryUid,
  getSubscribedBlocks,
  getUserIdentifier,
  isFlagEnabled,
  isNodeTitle,
  refreshConfigTree,
} from "./util";
import { NodeConfigPanel, RelationConfigPanel } from "./ConfigPanels";
import SubscriptionConfigPanel from "./SubscriptionConfigPanel";
import ReactDOM from "react-dom";

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

.roamjs-discourse-condition-source {
  min-width: 120px;
}

.roamjs-discourse-condition-relation {
  min-width: 168px;
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
}`);

const CONFIG = toConfig("discourse-graph");
const user = getUserIdentifier();

runExtension("discourse-graph", () => {
  const { pageUid } = createConfigObserver({
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
          ],
        },
        { id: "preview", fields: [], toggleable: true },
        {
          id: "grammar",
          fields: [
            {
              title: "nodes",
              type: "custom",
              description: "The types of nodes in your discourse graph",
              defaultValue: DEFAULT_NODE_VALUES,
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
          ],
        },
        { id: "render references", fields: [], toggleable: true },
      ],
      versioning: true,
    },
  });

  // Temporary shim
  const configTree = getBasicTreeByParentUid(pageUid);
  if (!configTree.some((t) => toFlexRegex("shimmed").test(t.text))) {
    const grammar = getSubTree({ tree: configTree, key: "grammar" }).children;
    const nodes = getSubTree({ tree: grammar, key: "nodes" }).children;
    const relations = getSubTree({ tree: grammar, key: "relations" }).children;
    relations.forEach((relation) => {
      const source = getSubTree({ tree: relation.children, key: "source" });
      const destination = getSubTree({
        tree: relation.children,
        key: "destination",
      });
      const sourceNode = nodes.find(
        (node) => source.children[0]?.text === node.text
      );
      const destinationNode = nodes.find(
        (node) => destination.children[0]?.text === node.text
      );
      getSubTree({ tree: relation.children, key: "if" }).children.forEach(
        (andTree) =>
          andTree.children.forEach((triple) => {
            const tripleNode = triple.children?.[0]?.children?.[0];
            if (tripleNode?.text === source.children[0]?.text) {
              updateBlock({ uid: tripleNode?.uid, text: "source" });
            } else if (tripleNode?.text === destination.children[0]?.text) {
              updateBlock({ uid: tripleNode?.uid, text: "destination" });
            }
          })
      );
      if (sourceNode) {
        updateBlock({ uid: source.children[0].uid, text: sourceNode.uid });
      }
      if (destinationNode) {
        updateBlock({
          uid: destination.children[0].uid,
          text: destinationNode.uid,
        });
      }
    });
    nodes.forEach((n) =>
      updateBlock({ uid: n.uid, text: `[[${n.text}]] - {content}` })
    );
    createBlock({
      node: { text: "shimmed" },
      parentUid: pageUid,
      order: configTree.length,
    });
  }
  setTimeout(refreshConfigTree, 1);

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
        const parent = d.querySelector("div.rm-reference-container");
        if (parent) {
          const p = document.createElement("div");
          parent.parentElement.insertBefore(p, parent);
          contextRender({ p, title: elToTitle(getPageTitleByHtmlElement(d)) });
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
  });

  setTimeout(() => {
    if (isFlagEnabled("preview")) {
      createHTMLObserver({
        useBody: true,
        tag: "SPAN",
        className: "rm-page-ref",
        callback: (s: HTMLSpanElement) => {
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
        },
      });
    }
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
        notificationRender({
          p: span,
          parentUid: uid,
          timestamp:
            Number(notificationBlock.children[1]?.text) || defaultTimestamp,
          configUid:
            notificationBlock.children[1]?.uid ||
            createBlock({
              node: { text: `${defaultTimestamp}` },
              parentUid: notificationBlock.uid,
              order: 1,
            }),
        });
      }, 1000);
    }
  };

  window.addEventListener("hashchange", (e) => {
    if (e.oldURL.endsWith(pageUid)) {
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
});
