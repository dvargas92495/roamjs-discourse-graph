import axios from "axios";
import { render as loadingRender } from "./components/LoadingAlert";
import { render as renderToast } from "roamjs-components/components/Toast";
import { Intent, Position } from "@blueprintjs/core";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import { v4 } from "uuid";
import setInputSetting from "roamjs-components/util/setInputSetting";
import getSubTree from "roamjs-components/util/getSubTree";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getAuthorizationHeader from "roamjs-components/util/getAuthorizationHeader";
import getGraph from "roamjs-components/util/getGraph";

const dataWorkerUrl = (document.currentScript as HTMLScriptElement).src.replace(
  /\/main\.js$/,
  "/data.js"
);
const dataWorker: { current: Worker; init: boolean } = {
  current: undefined,
  init: false,
};

export const listeners: { [name: string]: (a: unknown) => void } = {};
const loadGraph = (configUid: string, update = false) =>
  new Promise<void>((resolve) => {
    const closeLoadingToast: { current?: () => void } = {
      current: undefined,
    };
    const cachePathNodes = getSubTree({
      tree: getBasicTreeByParentUid(configUid),
      key: "cache",
    }).children;
    const opts = {
      headers: { Authorization: getAuthorizationHeader() },
    };
    listeners["init"] = ({ graph }: { graph?: string }) => {
      delete listeners["init"];
      dataWorker.init = true;
      document.body.dispatchEvent(new Event("roamjs:data-worked:init"));
      if (graph) {
        (cachePathNodes.length
          ? Promise.resolve(cachePathNodes[0]?.text)
          : Promise.resolve(v4()).then((value) =>
              setInputSetting({
                blockUid: configUid,
                key: "cache",
                value,
              }).then(() => value)
            )
        )
          .then((cachePath) =>
            axios.put(
              "https://lambda.roamjs.com/file",
              {
                dev: process.env.NODE_ENV === "development",
                extension: "discourse-graph",
                body: graph,
                path: `graph-cache/${cachePath}.json`,
              },
              opts
            )
          )
          .then(() => {
            closeLoadingToast.current?.();
            renderToast({
              id: "storage-success",
              content: `Successfully stored discourse graph cache!`,
              intent: Intent.SUCCESS,
            });
          })
          .catch((e) =>
            renderToast({
              id: "storage-error",
              content: `Unkown error: ${e.message}`,
              intent: Intent.DANGER,
            })
          );
      } else {
        closeLoadingToast.current?.();
        renderToast({
          id: "storage-success",
          content: `Successfully loaded graph from cache!`,
          intent: Intent.SUCCESS,
        });
      }
      resolve();
    };
    const loadCache = () =>
      new Promise((innerResolve) => {
        loadingRender({
          operation: () => {
            const blocks = window.roamAlphaAPI.q(`[:find 
          (pull ?b 
            [
              :db/id 
              :node/title 
              :block/string 
              :block/page 
              :block/refs 
              :block/uid 
              :block/children 
              [:create/time :as "createdTime"] 
              [:edit/time :as "editedTime"]
              [:user/display-name :as "displayName"]
              [:create/user :as "createdBy"]
            ]
          ) 
          :where ${
            update
              ? `[?b :edit/time ?t] [(< ${localStorage.getItem(
                  "graph-timestamp"
                )} ?t)]`
              : "[?b :block/uid]"
          }]`);
            innerResolve(blocks);
          },
          content: "Please wait as we load your graph's discourse data...",
        });
      });
    return (
      cachePathNodes.length
        ? axios
            .get(
              `https://lambda.roamjs.com/file?extension=discourse-graph${
                process.env.NODE_ENV === "development" ? "&dev=true" : ""
              }&path=graph-cache/${cachePathNodes[0]?.text}.json`,
              opts
            )
            .then((r) => r.data)
            .catch((e) => {
              if (e.response?.status === 404) {
                return Promise.all(
                  cachePathNodes.map((n) => deleteBlock(n.uid))
                ).then(loadCache);
              } else {
                throw e;
              }
            })
        : loadCache()
    )
      .then((blocks) => {
        closeLoadingToast.current = renderToast({
          id: "dataworker-loading",
          content: `Graph is continuing to build in the background...`,
          intent: Intent.PRIMARY,
          position: Position.BOTTOM_RIGHT,
          timeout: 0,
        });
        dataWorker.current.postMessage({
          method: "init",
          blocks,
          graph: getGraph(),
        });
      })
      .catch((e) => {
        renderToast({
          id: "load-graph",
          content: `Unkown error: ${e.message}`,
          intent: Intent.DANGER,
        });
      });
  });

export const refreshUi: { [k: string]: () => void } = {};
const refreshAllUi = () =>
  Object.entries(refreshUi).forEach(([k, v]) => {
    if (document.getElementById(k)) {
      v();
    } else {
      delete refreshUi[k];
    }
  });

export const initializeDataWorker = (configUid: string) =>
  axios
    .get(dataWorkerUrl, { responseType: "blob" })
    .then((r) => {
      dataWorker.current = new Worker(window.URL.createObjectURL(r.data));
      dataWorker.current.onmessage = (e) => {
        const { method, ...data } = e.data;
        listeners[method]?.(data);
      };
      return loadGraph(configUid);
    })
    .then(() => {
      window.roamAlphaAPI.ui.commandPalette.addCommand({
        label: "Refresh Discourse Data",
        callback: () => {
          deleteBlock(getSubTree({ parentUid: configUid, key: "cache" }).uid)
            .then(() => loadGraph(configUid))
            .then(refreshAllUi);
        },
      });
      window.roamAlphaAPI.ui.commandPalette.addCommand({
        label: "Update Discourse Data",
        callback: () => {
          loadGraph(configUid, true).then(refreshAllUi);
        },
      });
      return dataWorker.current;
    });

export const shutdownDataWorker = () => {
  window.roamAlphaAPI.ui.commandPalette.removeCommand({
    label: "Refresh Discourse Data",
  });
  window.roamAlphaAPI.ui.commandPalette.removeCommand({
    label: "Update Discourse Data",
  });
  dataWorker.current.terminate();
};

export const getDataWorker = (): Promise<Worker> =>
  dataWorker.current && dataWorker.init
    ? Promise.resolve(dataWorker.current)
    : new Promise((resolve) =>
        document.body.addEventListener("roamjs:data-worked:init", () =>
          resolve(dataWorker.current)
        )
      );
