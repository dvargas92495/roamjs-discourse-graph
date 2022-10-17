import createBlock from "roamjs-components/writes/createBlock";
import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
import getChildrenLengthByPageUid from "roamjs-components/queries/getChildrenLengthByPageUid";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import getPageTitleByHtmlElement from "roamjs-components/dom/getPageTitleByHtmlElement";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import runExtension from "roamjs-components/util/runExtension";
import toConfig from "roamjs-components/util/toConfigPageName";
import updateBlock from "roamjs-components/writes/updateBlock";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import { render as renderToast } from "roamjs-components/components/Toast";
import { render as importRender } from "./ImportDialog";
import { render as contextRender } from "./DiscourseContext";
import {
  initializeDataWorker,
  shutdownDataWorker,
} from "./dataWorkerClient";
import { render as overviewRender } from "./components/DiscourseGraphOverview";
import { render as notificationRender } from "./NotificationIcon";
import { render as queryRequestRender } from "./components/SendQueryRequest";
import { render as renderBlockFeed } from "./components/BlockFeed";
import {
  getUserIdentifier,
  isDiscourseNode,
} from "./util";
import ReactDOM from "react-dom";
import importDiscourseGraph from "./utils/importDiscourseGraph";
import { Intent } from "@blueprintjs/core";
import createButtonObserver from "roamjs-components/dom/createButtonObserver";
import getUidsFromButton from "roamjs-components/dom/getUidsFromButton";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import addScriptAsDependency from "roamjs-components/dom/addScriptAsDependency";
import type { DatalogClause } from "roamjs-components/types/native";
import fireWorkerQuery, { FireQuery } from "./utils/fireWorkerQuery";
import registerExperimentalMode from "roamjs-components/util/registerExperimentalMode";
import getSamePageApi from "./utils/getSamePageApi";
import apiPost from "roamjs-components/util/apiPost";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";

const CONFIG = toConfig("discourse-graph");
const user = getUserIdentifier();

const extensionId = "discourse-graph";

export default runExtension({
  extensionId,
  run: async () => {
    apiPost({
      path: "graphs",
      data: {
        extension: "discourse-graph",
        graph: window.roamAlphaAPI.graph.name,
      },
    });

    let fireQueryRef: FireQuery;
    registerExperimentalMode({
      feature: "Cached Graph",
      onEnable: () => {
        initializeDataWorker(
          getPageUidByPageTitle("roam/js/discourse-graph")
        ).then((worker) => {
          const swapFireQuery = () => {
            fireQueryRef = window.roamjs.extension.queryBuilder.fireQuery;
            window.roamjs.extension.queryBuilder.fireQuery = async (args) => {
              // @ts-ignore temporary
              const { getDatalogQueryComponents } =
                window.roamjs.extension.queryBuilder;
              const { where, definedSelections } = (
                getDatalogQueryComponents as (
                  args: Parameters<FireQuery>[0]
                ) => {
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
                    label: field.endsWith("uid")
                      ? `${sel.label}-uid`
                      : sel.label,
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

    const samePageLoadedListener = () => {
      const { addGraphListener, sendToGraph } = getSamePageApi();
      addGraphListener({
        operation: "IMPORT_DISCOURSE_GRAPH",
        handler: (data: Parameters<typeof importDiscourseGraph>[0], graph) => {
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
          sendToGraph({
            operation: "IMPORT_DISCOURSE_GRAPH_CONFIRM",
            graph,
          });
        },
      });
      addGraphListener({
        operation: "IMPORT_DISCOURSE_GRAPH_CONFIRM",
        handler: (_, graph) =>
          renderToast({
            id: "import-p2p-success",
            content: `${graph} successfully imported your discourse graph!`,
          }),
      });
      addGraphListener({
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
          sendToGraph({
            operation: "QUERY_REQUEST_RECEIVED",
            graph,
          });
        },
      });
    };
    document.body.addEventListener(
      "roamjs:multiplayer:loaded",
      samePageLoadedListener,
      { once: true }
    );
    document.body.addEventListener(
      "roamjs:samepage:loaded",
      samePageLoadedListener,
      { once: true }
    );
    if (process.env.NODE_ENV === "production") {
      addScriptAsDependency({
        id: "roamjs-query-builder-main",
        src: `https://roamjs.com/query-builder/main.js`,
        dataAttributes: { source: "discourse-graph" },
      });
    }

    window.roamAlphaAPI.ui.commandPalette.addCommand({
      label: "Import Discourse Graph",
      callback: () => importRender({}),
    });

    window.roamAlphaAPI.ui.commandPalette.addCommand({
      label: "Send Query Request",
      callback: () => {
        queryRequestRender({
          uid: window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"],
        });
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
            const { sendToGraph, addGraphListener, removeGraphListener } =
              getSamePageApi();
            sendToGraph({
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
            addGraphListener({
              operation,
              handler: (_, g) => {
                if (g === graph) {
                  renderToast({
                    id: "query-response-success",
                    content: `Graph ${g} Successfully Received the query`,
                    intent: Intent.SUCCESS,
                  });
                  removeGraphListener({
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

    createHTMLObserver({
      tag: "H1",
      className: "rm-title-display",
      callback: (h1: HTMLHeadingElement) => {
        const title = elToTitle(h1);
        if (title === "Discourse Graph Overview") {
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
        const order = getChildrenLengthByPageUid(parentUid);
        createBlock({ parentUid, node: { text }, order });
      }
    };

    const referencesObserver = createHTMLObserver({
      tag: "DIV",
      useBody: true,
      className: "rm-reference-main",
      callback: async (d: HTMLDivElement) => {
        const isMain = !!d.closest(".roam-article");
        const uid = isMain
          ? await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid()
          : getPageUidByPageTitle(elToTitle(getPageTitleByHtmlElement(d)));
        if (
          isDiscourseNode(uid) &&
          !d.getAttribute("data-roamjs-discourse-context")
        ) {
          d.setAttribute("data-roamjs-discourse-context", "true");
          const parent =
            d.querySelector("div.rm-reference-container") || d.children[0];
          if (parent) {
            const p = document.createElement("div");
            parent.parentElement.insertBefore(p, parent);
            contextRender({
              parent: p,
              uid,
            });
          }
        }
      },
    });

    const getSubscribedBlocks = () =>
      //treeRef.tree
      getBasicTreeByParentUid(
        getPageUidByPageTitle("roam/js/discourse-graph")
      ).find((s) => toFlexRegex("subscriptions").test(s.text))?.children || [];

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
      const oldIcon = document.getElementById(
        "roamjs-discourse-notification-icon"
      );
      if (oldIcon) {
        ReactDOM.unmountComponentAtNode(oldIcon);
        oldIcon.remove();
      }
      showNotificationIcon(e.newURL);
    });
    showNotificationIcon(window.location.hash);

    window.roamAlphaAPI.ui.commandPalette.addCommand({
      label: "Open Feed",
      callback: () => renderBlockFeed({}),
    });
    return {
      observers: [referencesObserver],
    };
  },
});
