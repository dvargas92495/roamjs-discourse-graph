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
import getSamePageApi from "@samepage/external/getSamePageAPI";
import apiPost from "roamjs-components/util/apiPost";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getSubTree from "roamjs-components/util/getSubTree";

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

    const pageUid = getPageUidByPageTitle("roam/js/discourse-graph");
    const configTree = getBasicTreeByParentUid(pageUid);
    const surveyed = getSubTree({ tree: configTree, key: "surveyed" });
    if (!surveyed.uid) {
      let dismissed = true;
      const closeSurvey = renderToast({
        position: "bottom-right",
        content: `👋 Greetings! 👋 

The discourse graph team is trying to understand how people are using the discourse graph extension, or not (as part of the larger research project it is a part of; context [here](https://twitter.com/JoelChan86/status/1570853004458491904?s=20&t=iAC5Tx3PYrMBhqCp9UAYOw)). 

Survey link is here: https://go.umd.edu/discourse-graph-survey

If you’ve explored/used the discourse graph extension in any capacity, we would be so grateful if you could take a few minutes to contribute to the survey!

Click on the ⏰ to dismiss and see this message later when you reload Roam.

Click on the ✖️ to dismiss for good (you won't see this message again).`,
        id: "discourse-survey",
        timeout: 0,
        onDismiss: () =>
          dismissed &&
          createBlock({ parentUid: pageUid, node: { text: "surveyed" } }),
        action: {
          text: "⏰",
          onClick: () => {
            dismissed = false;
            closeSurvey();
          },
        },
      });
    }

    const samePageLoadedListener = async () => {
      const { addNotebookListener, sendToNotebook } = await getSamePageApi();
      addNotebookListener({
        operation: "IMPORT_DISCOURSE_GRAPH",
        handler: (
          data: Parameters<typeof importDiscourseGraph>[0],
          notebook
        ) => {
          importDiscourseGraph(data);
          const todayUid = window.roamAlphaAPI.util.dateToPageUid(new Date());
          const todayOrder = getChildrenLengthByPageUid(todayUid);
          createBlock({
            parentUid: todayUid,
            order: todayOrder,
            node: {
              text: `Imported discourse graph from [[${notebook.workspace}]]`,
              children: [{ text: `[[${data.title}]]` }],
            },
          });
          sendToNotebook({
            operation: "IMPORT_DISCOURSE_GRAPH_CONFIRM",
            target: notebook.uuid,
          });
        },
      });
      addNotebookListener({
        operation: "IMPORT_DISCOURSE_GRAPH_CONFIRM",
        handler: (_, graph) =>
          renderToast({
            id: "import-p2p-success",
            content: `${graph} successfully imported your discourse graph!`,
          }),
      });
      addNotebookListener({
        operation: "QUERY_REQUEST",
        handler: (json, notebook) => {
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
              text: `New [[query request]] from [[${notebook.workspace}]]`,
              children: [
                {
                  text: `Get full page contents of [[${page}]]`,
                },
                {
                  text: `{{Accept:${notebook.workspace}:${requestId}:${page}}}`,
                },
              ],
            },
          });
          renderToast({
            id: "new-query-request",
            content: `New query request from ${notebook.workspace}`,
            intent: Intent.PRIMARY,
          });
          sendToNotebook({
            operation: "QUERY_REQUEST_RECEIVED",
            target: notebook.uuid,
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
        b.onclick = async () => {
          const { blockUid } = getUidsFromButton(b);
          const text = getTextByBlockUid(blockUid);
          const parts = (/{{([^}]+)}}/.exec(text)?.[1] || "").split(":");
          if (parts.length >= 4) {
            const [, graph, requestId, ...page] = parts;
            const title = page.join(":");
            const uid = getPageUidByPageTitle(title);
            const tree = getFullTreeByParentUid(uid).children;
            const {
              sendToNotebook,
              addNotebookListener,
              removeNotebookListener,
            } = await getSamePageApi();
            sendToNotebook({
              target: { app: 1, workspace: graph },
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
            addNotebookListener({
              operation,
              handler: (_, n) => {
                if (n.workspace === graph) {
                  renderToast({
                    id: "query-response-success",
                    content: `Graph ${n.workspace} Successfully Received the query`,
                    intent: Intent.SUCCESS,
                  });
                  removeNotebookListener({
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
