import { Button, Popover, Position } from "@blueprintjs/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { v4 } from "uuid";
import { ContextContent } from "../DiscourseContext";
import { getDiscourseContextResults } from "../util";
import { useInViewport } from "react-in-viewport";
import differenceInMilliseconds from "date-fns/differenceInMilliseconds";
import axios from "axios";
import { render as loadingRender } from "./LoadingAlert";

const dataWorker: { current: Worker, init: boolean } = { current: undefined, init: false };
const listeners: { [name: string]: (a: unknown) => void } = {};
const initGraph = () => {
  loadingRender({
    operation: () => {
      const startLoading = new Date();
      console.log("started loading", startLoading);
      listeners["init"] = (e: { method: string; count: number }) => {
        console.log(
          "Received",
          e.count,
          "blocks",
          differenceInMilliseconds(new Date(), startLoading)
        );
        delete listeners["init"];
        dataWorker.init = true;
      };
      dataWorker.current.postMessage({
        method: "init",
        start: startLoading.valueOf(),
        blocks: window.roamAlphaAPI.q(`[:find 
          (pull ?b 
            [:db/id [:node/title :as "text"] [:block/string :as "text"] :block/page :block/refs :block/uid :block/children [:create/time :as "createdTime"] [:edit/time :as "editedTime"]]
          ) 
          :where [?b :block/uid]]`),
      });
    },
    content: "Please wait as we load your graph's discourse data...",
  });
};
window.roamAlphaAPI.ui.commandPalette.addCommand({
  label: "Refresh Cache",
  callback: initGraph,
});

axios
  .get(
    (document.currentScript as HTMLScriptElement).src.replace(
      /\/main\.js$/,
      "/data.js"
    ),
    { responseType: "blob" }
  )
  .then((r) => {
    dataWorker.current = new Worker(window.URL.createObjectURL(r.data));
    dataWorker.current.onmessage = (e) => {
      const { method, ...data } = e.data;
      listeners[method]?.(data);
    };
    initGraph();
  });

const getDataWorker = (attempt = 1): Promise<Worker> =>
  dataWorker.current && dataWorker.init
    ? Promise.resolve(dataWorker.current)
    : attempt < 100
    ? new Promise((resolve) =>
        setTimeout(() => resolve(getDataWorker(attempt + 1)), attempt * 10)
      )
    : Promise.reject("Failed to load data worker");

const cache: {
  [title: string]: {
    results: ReturnType<typeof getDiscourseContextResults>;
    refs: number;
  };
} = {};
type CacheData = typeof cache[string];
const refreshUi: { [k: string]: () => void } = {};

export const refreshOverlayCounters = () => {
  Object.entries(refreshUi).forEach(([k, v]) => {
    if (document.getElementById(k)) {
      v();
    } else {
      delete refreshUi[k];
    }
  });
};

const getOverlayInfo = (tag: string): Promise<CacheData> => {
  if (cache[tag]) return Promise.resolve(cache[tag]);
  return new Promise<CacheData>((resolve) => {
    listeners[`discourse-${tag}`] = (args: CacheData) => {
      cache[tag] = args;
      resolve(args);
      delete listeners[`discourse-${tag}`];
    };
    getDataWorker().then((worker) =>
      worker.postMessage({
        method: `discourse`,
        tag,
      })
    );
  });
};

const DiscourseContextOverlay = ({ tag, id }: { tag: string; id: string }) => {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [refs, setRefs] = useState(0);
  const getInfo = useCallback(
    () =>
      getOverlayInfo(tag).then(({ refs, results }) => {
        setResults(results);
        setRefs(refs);
        setLoading(false);
      }),
    [tag, setResults, setLoading, setRefs]
  );
  const refresh = useCallback(() => {
    setLoading(true);
    delete cache[tag];
    getInfo();
  }, [getInfo, tag, setLoading]);
  useEffect(() => {
    refreshUi[id] = refresh;
    getInfo();
  }, [refresh, getInfo]);
  return (
    <Popover
      content={
        <div
          className="roamjs-discourse-context-popover"
          style={{
            padding: 16,
            maxWidth: 720,
          }}
        >
          <ContextContent title={tag} results={results} />
        </div>
      }
      target={
        <Button
          id={id}
          className={"roamjs-discourse-context-overlay"}
          minimal
          text={`${
            results.flatMap((r) => Object.entries(r.results)).length
          } | ${refs}`}
          icon={"diagram-tree"}
          rightIcon={"link"}
          disabled={loading}
        />
      }
      position={Position.BOTTOM}
      modifiers={{
        flip: { enabled: false },
        preventOverflow: { enabled: false },
      }}
    />
  );
};

const Wrapper = ({ parent, tag }: { parent: HTMLElement; tag: string }) => {
  const id = useMemo(() => v4(), []);
  const { inViewport } = useInViewport(
    { current: parent },
    {},
    { disconnectOnLeave: false },
    {}
  );
  return inViewport ? (
    <DiscourseContextOverlay tag={tag} id={id} />
  ) : (
    <Button
      id={id}
      minimal
      text={`0 | 0`}
      icon={"diagram-tree"}
      rightIcon={"link"}
      className={"roamjs-discourse-context-overlay"}
      disabled={true}
    />
  );
};

export const render = ({
  tag,
  parent,
}: {
  tag: string;
  parent: HTMLElement;
}) => {
  parent.style.margin = "0 8px";
  parent.onmousedown = (e) => e.stopPropagation();
  ReactDOM.render(<Wrapper tag={tag} parent={parent} />, parent);
};
