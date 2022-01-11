import { Button, Popover, Position } from "@blueprintjs/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { v4 } from "uuid";
import { ContextContent } from "../DiscourseContext";
import { getDiscourseContextResults } from "../util";
import { useInViewport } from "react-in-viewport";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import differenceInMilliseconds from "date-fns/differenceInMilliseconds";

const cache: {
  [title: string]: {
    results: ReturnType<typeof getDiscourseContextResults>;
    refs: number;
  };
} = {};
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

const overlayQueue: (() => void)[] = [];

const getOverlayInfo = (
  tag: string
): Promise<{
  refs: number;
  results: ReturnType<typeof getDiscourseContextResults>;
}> => {
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
