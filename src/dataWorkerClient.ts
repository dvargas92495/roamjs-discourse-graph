import { render as renderToast } from "roamjs-components/components/Toast";
import { Intent, Position } from "@blueprintjs/core";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import setInputSetting from "roamjs-components/util/setInputSetting";
import getSubTree from "roamjs-components/util/getSubTree";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getAuthorizationHeader from "roamjs-components/util/getAuthorizationHeader";
import nanoid from "nanoid";

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
    listeners["init"] = ({ id, error }: { id?: string; error?: string }) => {
      delete listeners["init"];
      dataWorker.init = true;
      document.body.dispatchEvent(new Event("roamjs:data-worked:init"));
      if (error) {
        Promise.all(cachePathNodes.map((n) => deleteBlock(n.uid))).then(() => {
          closeLoadingToast.current?.();
          renderToast({
            id: "storage-error",
            content: `Failed to load graph: ${error}`,
            intent: Intent.DANGER,
          });
          resolve();
        });
      } else if (id) {
        setInputSetting({
          blockUid: configUid,
          key: "cache",
          value: id,
        }).then(() => {
          closeLoadingToast.current?.();
          renderToast({
            id: "storage-success",
            content: `Successfully stored discourse graph data!`,
            intent: Intent.SUCCESS,
          });
          resolve();
        });
      } else {
        closeLoadingToast.current?.();
        renderToast({
          id: "storage-success",
          content: `Successfully loaded graph from cache!`,
          intent: Intent.SUCCESS,
        });
        resolve();
      }
    };
    closeLoadingToast.current = renderToast({
      id: "dataworker-loading",
      content: `Discourse graph is building in the background...`,
      intent: Intent.PRIMARY,
      position: Position.BOTTOM_RIGHT,
      timeout: 0,
    });
    dataWorker.current.postMessage({
      method: "init",
      graph: window.roamAlphaAPI.graph.name,
      id: cachePathNodes.length ? cachePathNodes[0]?.text : nanoid(),
      cached: !!cachePathNodes.length,
      authorization: getAuthorizationHeader(),
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
  fetch(dataWorkerUrl)
    .then((r) => r.blob())
    .then((r) => {
      dataWorker.current = new Worker(window.URL.createObjectURL(r));
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
      return dataWorker.current;
    });

export const shutdownDataWorker = () => {
  window.roamAlphaAPI.ui.commandPalette.removeCommand({
    label: "Refresh Discourse Data",
  });
  window.roamAlphaAPI.ui.commandPalette.removeCommand({
    label: "Update Discourse Data",
  });
  dataWorker.current?.terminate();
};

export const getDataWorker = (): Promise<Worker> =>
  dataWorker.current && dataWorker.init
    ? Promise.resolve(dataWorker.current)
    : new Promise((resolve) =>
        document.body.addEventListener("roamjs:data-worked:init", () =>
          resolve(dataWorker.current)
        )
      );
