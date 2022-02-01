import { Button, Popover, Position } from "@blueprintjs/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { v4 } from "uuid";
import { ContextContent } from "../DiscourseContext";
import { getDiscourseContextResults, isFlagEnabled } from "../util";
import { useInViewport } from "react-in-viewport";
import {
  getDataWorker,
  initializeDataWorker,
  listeners,
  refreshUi,
  shutdownDataWorker,
} from "../dataWorkerClient";
import { render as renderToast } from "roamjs-components/components/Toast";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import differenceInMilliseconds from "date-fns/differenceInMilliseconds";

type DiscourseData = {
  results: ReturnType<typeof getDiscourseContextResults>;
  refs: number;
};

let experimentalOverlayMode = false;

document.addEventListener("keydown", (e) => {
  if (e.shiftKey && e.altKey && e.ctrlKey && e.metaKey && e.key === "M") {
    experimentalOverlayMode = !experimentalOverlayMode;
    if (isFlagEnabled("grammar.overlay")) {
      if (experimentalOverlayMode) {
        initializeDataWorker();
      } else {
        shutdownDataWorker();
      }
    }
    renderToast({
      id: "experimental",
      content: `${
        experimentalOverlayMode ? "En" : "Dis"
      }abled Experimental Overlay Mode`,
    });
  }
});

export const getExperimentalOverlayMode = () => experimentalOverlayMode;

const cache: {
  [title: string]: DiscourseData;
} = {};
const overlayQueue: (() => void)[] = [];
const getOverlayInfo = (tag: string): Promise<DiscourseData> => {
  if (experimentalOverlayMode) {
    return new Promise<DiscourseData>((resolve) => {
      listeners[`discourse-${tag}`] = (args: DiscourseData) => {
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
  } else {
    if (cache[tag]) return Promise.resolve(cache[tag]);
    return new Promise((resolve) => {
      const triggerNow = overlayQueue.length === 0;
      overlayQueue.push(() => {
        const start = new Date();
        const output = (cache[tag] = {
          results: getDiscourseContextResults(tag),
          refs: window.roamAlphaAPI.q(
            `[:find ?a :where [?b :node/title "${normalizePageTitle(
              tag
            )}"] [?a :block/refs ?b]]`
          ).length,
        });
        const runTime = differenceInMilliseconds(new Date(), start);
        setTimeout(() => {
          overlayQueue.splice(0, 1);
          overlayQueue[0]?.();
        }, runTime * 4);
        resolve(output);
      });
      if (triggerNow) overlayQueue[0]();
    });
  }
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
    getInfo();
  }, [getInfo, setLoading]);
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
