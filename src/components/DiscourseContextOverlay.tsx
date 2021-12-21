import { Button, Popover, Position } from "@blueprintjs/core";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import ReactDOM from "react-dom";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import { v4 } from "uuid";
import { ContextContent } from "../DiscourseContext";
import { getDiscourseContextResults, isNodeTitle } from "../util";

const cache: {
  [title: string]: {
    results: ReturnType<typeof getDiscourseContextResults>;
    refs: number;
  };
} = {};

const refreshUi: { [k: string]: () => void } = {};

export const refreshOverlayCounters = () => {
  const pageRefCount: { [k: string]: number } = {};
  window.roamAlphaAPI
    .q("[:find (pull ?b [:node/title]) ?a :where [?a :block/refs ?b]]")
    .map((a) => a[0]?.title as string)
    .filter((a) => !!a)
    .forEach((a) => {
      if (pageRefCount[a]) pageRefCount[a]++;
      else pageRefCount[a] = 1;
    });
  getAllPageNames()
    .filter(isNodeTitle)
    .forEach(
      (s) =>
        (cache[s] = {
          results: getDiscourseContextResults(s),
          refs: pageRefCount[s] || 0,
        })
    );
  Object.entries(refreshUi).forEach(([k, v]) => {
    if (document.getElementById(k)) {
      v();
    } else {
      delete refreshUi[k];
    }
  });
};

const DiscourseContextOverlay = ({ tag }: { tag: string }) => {
  const id = useMemo(() => v4(), []);
  const [results, setResults] = useState(cache[tag].results);
  const [refs, setRefs] = useState(cache[tag].refs);
  const refresh = useCallback(() => {
    setResults(cache[tag].results);
    setRefs(cache[tag].refs);
  }, [tag, setResults, setRefs]);
  useEffect(() => {
    refreshUi[id] = refresh;
  }, [refresh]);
  return (
    <Popover
      content={
        <div style={{ padding: 16, maxWidth: 300 }}>
          <ContextContent title={tag} results={results} />
        </div>
      }
      target={
        <Button
          id={id}
          minimal
          text={`${
            results.flatMap((r) => Object.entries(r.results)).length
          } | ${refs}`}
          icon={"diagram-tree"}
          rightIcon={"graph"}
        />
      }
      position={Position.BOTTOM_RIGHT}
      modifiers={{
        flip: { enabled: false },
        preventOverflow: { enabled: false },
      }}
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
  ReactDOM.render(<DiscourseContextOverlay tag={tag} />, parent);
};
