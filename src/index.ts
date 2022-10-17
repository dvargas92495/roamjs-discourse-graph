import createBlock from "roamjs-components/writes/createBlock";
import getChildrenLengthByPageUid from "roamjs-components/queries/getChildrenLengthByPageUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import runExtension from "roamjs-components/util/runExtension";
import updateBlock from "roamjs-components/writes/updateBlock";
import { render as renderToast } from "roamjs-components/components/Toast";
import { render as importRender } from "./ImportDialog";
import { render as queryRequestRender } from "./components/SendQueryRequest";
import importDiscourseGraph from "./utils/importDiscourseGraph";
import { Intent } from "@blueprintjs/core";
import createButtonObserver from "roamjs-components/dom/createButtonObserver";
import getUidsFromButton from "roamjs-components/dom/getUidsFromButton";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import addScriptAsDependency from "roamjs-components/dom/addScriptAsDependency";
import getSamePageApi from "./utils/getSamePageApi";
import apiPost from "roamjs-components/util/apiPost";

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
  },
});
