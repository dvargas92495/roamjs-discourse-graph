import { Button, Popover, Position } from "@blueprintjs/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { v4 } from "uuid";
import { ContextContent } from "../DiscourseContext";
import { getDiscourseContextResults } from "../util";
import { useInViewport } from "react-in-viewport";
import { getDataWorker, listeners, refreshUi } from "../dataWorkerClient";

type DiscourseData = {
  results: ReturnType<typeof getDiscourseContextResults>;
  refs: number;
};

const getOverlayInfo = (tag: string): Promise<DiscourseData> => {
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
