import { Button, Popover, Position } from "@blueprintjs/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { v4 } from "uuid";
import { ContextContent } from "../DiscourseContext";
import { getDiscourseContextResults } from "../util";
import { useInViewport } from "react-in-viewport";

const resultsCache: {
  [title: string]: ReturnType<typeof getDiscourseContextResults>;
} = {};
const refCache: {
  [title: string]: number;
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

const DiscourseContextOverlay = ({ tag, id }: { tag: string; id: string }) => {
  const getResults = useCallback(
    () =>
      resultsCache[tag] ||
      (resultsCache[tag] = getDiscourseContextResults(tag)),
    [tag]
  );
  const getRefs = useCallback(() => {
    return (
      refCache[tag] ||
      (refCache[tag] = window.roamAlphaAPI.q(
        `[:find ?a :where [?b :node/title "${tag}"] [?a :block/refs ?b]]`
      ).length)
    );
  }, [tag]);
  const [results, setResults] = useState(getResults);
  const [refs, setRefs] = useState(getRefs);
  const refresh = useCallback(() => {
    delete refCache[tag];
    delete resultsCache[tag];
    setResults(getResults);
    setRefs(getRefs);
  }, [getResults, setResults, setRefs, getRefs, tag]);
  useEffect(() => {
    refreshUi[id] = refresh;
  }, [refresh]);
  return (
    <Popover
      content={
        <div className="roamjs-discourse-context-popover" style={{ padding: 16, maxWidth: 300 }}>
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
        />
      }
      placement={"auto"}
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
