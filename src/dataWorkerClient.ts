import axios from "axios";
import { render as loadingRender } from "./components/LoadingAlert";
import localStorageGet from "roamjs-components/util/localStorageGet";
import localStorageSet from "roamjs-components/util/localStorageSet";
import localStorageRemove from "roamjs-components/util/localStorageRemove";
import { render as renderToast } from "roamjs-components/components/Toast";
import { Intent, Position } from "@blueprintjs/core";

const dataWorkerUrl = (document.currentScript as HTMLScriptElement).src.replace(
  /\/main\.js$/,
  "/data.js"
);
const dataWorker: { current: Worker; init: boolean } = {
  current: undefined,
  init: false,
};
export const listeners: { [name: string]: (a: unknown) => void } = {};
const loadGraph = (update = false) =>
  new Promise<void>((resolve) => {
    const closeLoadingToast: { current?: () => void } = {
      current: undefined,
    };
    listeners["init"] = ({ graph }: { graph?: string }) => {
      delete listeners["init"];
      dataWorker.init = true;
      document.body.dispatchEvent(new Event("roamjs:data-worked:init"));
      closeLoadingToast.current?.();
      if (graph) {
        try {
          localStorageSet("graph-cache", graph);
          renderToast({
            id: "localstorage-success",
            content: `Successfully loaded graph into cache! (${graph.length})`,
            intent: Intent.SUCCESS,
          });
        } catch (e) {
          if (e.name === "QuotaExceededError") {
            renderToast({
              id: "localstorage-error",
              content: `Failed to store your graph cache locally - it's too large.`,
              intent: Intent.DANGER,
            });
          } else {
            renderToast({
              id: "localstorage-error",
              content: `Unkown error: ${e.message}`,
              intent: Intent.DANGER,
            });
          }
        }
      } else {
        renderToast({
          id: "localstorage-success",
          content: `Successfully loaded graph from cache!`,
          intent: Intent.SUCCESS,
        });
      }
      resolve();
    };
    const cache = localStorageGet("graph-cache");
    return (
      cache
        ? Promise.resolve(cache)
        : new Promise((innerResolve) => {
            loadingRender({
              operation: () => {
                const blocks = window.roamAlphaAPI.q(`[:find 
                (pull ?b 
                  [:db/id [:node/title :as "text"] [:block/string :as "text"] :block/page :block/refs :block/uid :block/children [:create/time :as "createdTime"] [:edit/time :as "editedTime"]]
                ) 
                :where ${
                  update
                    ? `[?b :edit/time ?t] [(< ${localStorage.getItem(
                        "graph-timestamp"
                      )} ?t)]`
                    : "[?b :block/uid]"
                }]`);
                if (update) {
                  console.log(blocks);
                }
                innerResolve(blocks);
              },
              content: "Please wait as we load your graph's discourse data...",
            });
          })
    ).then((blocks) => {
      localStorageSet("graph-timestamp", new Date().valueOf().toString());
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
      });
    });
  });

export const initializeDataWorker = () =>
  axios.get(dataWorkerUrl, { responseType: "blob" }).then((r) => {
    dataWorker.current = new Worker(window.URL.createObjectURL(r.data));
    dataWorker.current.onmessage = (e) => {
      const { method, ...data } = e.data;
      listeners[method]?.(data);
    };
    loadGraph();
  });

export const getDataWorker = (): Promise<Worker> =>
  dataWorker.current && dataWorker.init
    ? Promise.resolve(dataWorker.current)
    : new Promise((resolve) =>
        document.body.addEventListener("roamjs:data-worked:init", () =>
          resolve(dataWorker.current)
        )
      );

export const refreshUi: { [k: string]: () => void } = {};
const refreshAllUi = () =>
  Object.entries(refreshUi).forEach(([k, v]) => {
    if (document.getElementById(k)) {
      v();
    } else {
      delete refreshUi[k];
    }
  });
export const refreshDiscourseData = () => {
  localStorageRemove("graph-cache");
  loadGraph().then(refreshAllUi);
};
export const updateDiscourseData = () => {
  loadGraph(true).then(refreshAllUi);
};
