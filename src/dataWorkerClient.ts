import axios from "axios";
import { render as loadingRender } from "./components/LoadingAlert";
import localStorageGet from "roamjs-components/util/localStorageGet";
import localStorageSet from "roamjs-components/util/localStorageSet";
import { render as renderToast } from "roamjs-components/components/Toast";
import { Intent } from "@blueprintjs/core";

const dataWorkerUrl = (document.currentScript as HTMLScriptElement).src.replace(
  /\/main\.js$/,
  "/data.js"
);
const dataWorker: { current: Worker; init: boolean } = {
  current: undefined,
  init: false,
};
export const listeners: { [name: string]: (a: unknown) => void } = {};
const loadGraph = () =>
  new Promise<void>((resolve) => {
    listeners["init"] = ({ graph }: { graph?: string }) => {
      delete listeners["init"];
      dataWorker.init = true;
      if (graph) {
        try {
          localStorageSet("graph-cache", graph);
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
        renderToast({
          id: "localstorage-success",
          content: `Successfully loaded graph into cache!`,
          intent: Intent.SUCCESS,
        });
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
                :where [?b :block/uid]]`);
                innerResolve(blocks);
              },
              content: "Please wait as we load your graph's discourse data...",
            });
          })
    ).then((blocks) => {
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

export const getDataWorker = (attempt = 1): Promise<Worker> =>
  dataWorker.current && dataWorker.init
    ? Promise.resolve(dataWorker.current)
    : attempt < 100
    ? new Promise((resolve) =>
        setTimeout(() => resolve(getDataWorker(attempt + 1)), attempt * 10)
      )
    : Promise.reject("Failed to load data worker");

export const refreshUi: { [k: string]: () => void } = {};
export const refreshDiscourseData = () => {
  loadGraph().then(() =>
    Object.entries(refreshUi).forEach(([k, v]) => {
      if (document.getElementById(k)) {
        v();
      } else {
        delete refreshUi[k];
      }
    })
  );
};
