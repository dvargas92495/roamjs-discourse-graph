import { Button, Popover, Position, Tooltip } from "@blueprintjs/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { ContextContent } from "../DiscourseContext";
import {
  getDiscourseContextResults,
  getNodes,
  getRelations,
  matchNode,
} from "../util";
import { useInViewport } from "react-in-viewport";
import { refreshUi } from "../dataWorkerClient";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import differenceInMilliseconds from "date-fns/differenceInMilliseconds";
import deriveNodeAttribute from "../utils/deriveNodeAttribute";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import nanoid from "nanoid";
import localStorageGet from "roamjs-components/util/localStorageGet";
import fireWorkerQuery from "../utils/fireWorkerQuery";

type DiscourseData = {
  results: Awaited<ReturnType<typeof getDiscourseContextResults>>;
  refs: number;
};

const cache: {
  [title: string]: DiscourseData;
} = {};
const overlayQueue: (() => Promise<void>)[] = [];
const getOverlayInfo = (tag: string): Promise<DiscourseData> => {
  if (cache[tag]) return Promise.resolve(cache[tag]);
  const nodes = getNodes();
  const relations = getRelations();
  return new Promise((resolve) => {
    const triggerNow = overlayQueue.length === 0;
    overlayQueue.push(() => {
      const start = new Date();
      return getDiscourseContextResults(tag, nodes, relations, true).then(
        (results) => {
          const output = (cache[tag] = {
            results,
            refs: window.roamAlphaAPI.data.fast.q(
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
        }
      );
    });
    if (triggerNow) overlayQueue[0]();
  });
};

const experimentalGetOverlayInfo = (title: string) =>
  Promise.all([
    getDiscourseContextResults(title),
    fireWorkerQuery({
      where: [
        {
          type: "data-pattern",
          arguments: [
            { type: "variable", value: "b" },
            { type: "constant", value: ":node/title" },
            { type: "constant", value: `"${title}"` },
          ],
        },
        {
          type: "data-pattern",
          arguments: [
            { type: "variable", value: "a" },
            { type: "constant", value: ":block/refs" },
            { type: "variable", value: `b` },
          ],
        },
      ],
      pull: [],
    }),
  ]).then(([results, allrefs]) => ({ results, refs: allrefs.length }));

const DiscourseContextOverlay = ({ tag, id }: { tag: string; id: string }) => {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<DiscourseData["results"]>([]);
  const [refs, setRefs] = useState(0);
  const getInfo = useCallback(
    () =>
      (localStorageGet("experimental") === "true"
        ? experimentalGetOverlayInfo(tag)
        : getOverlayInfo(tag)
      ).then(({ refs, results }) => {
        setResults(results);
        setRefs(refs);
        setLoading(false);
      }),
    [tag, setResults, setLoading, setRefs]
  );
  const score = useMemo(() => {
    const nodeType = getNodes().find((n) =>
      matchNode({ format: n.format, title: tag })
    )?.type;
    if (!nodeType)
      return results.flatMap((r) => Object.entries(r.results)).length;
    const attribute = getSettingValueFromTree({
      tree: getBasicTreeByParentUid(nodeType),
      key: "Overlay",
      defaultValue: "Overlay",
    });
    return deriveNodeAttribute({ title: tag, attribute, results });
  }, [results, tag]);
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
            position: "relative",
          }}
        >
          <ContextContent title={tag} results={results} />
          <span style={{ position: "absolute", bottom: "8px", left: "8px" }}>
            <Tooltip content={"Refresh Overlay"}>
              <Button
                icon={"refresh"}
                minimal
                onClick={() => {
                  delete cache[tag];
                  refresh();
                }}
              />
            </Tooltip>
          </span>
        </div>
      }
      target={
        <Button
          id={id}
          className={"roamjs-discourse-context-overlay"}
          minimal
          text={`${score} | ${refs}`}
          icon={"diagram-tree"}
          rightIcon={"link"}
          disabled={loading}
        />
      }
      position={Position.BOTTOM}
    />
  );
};

const Wrapper = ({ parent, tag }: { parent: HTMLElement; tag: string }) => {
  const id = useMemo(() => nanoid(), []);
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
  const actualRender = () =>
    ReactDOM.render(<Wrapper tag={tag} parent={parent} />, parent);
  if (window.roamjs.extension.queryBuilder) {
    actualRender();
  } else {
    document.body.addEventListener(
      "roamjs:discourse-graph:query-builder",
      actualRender,
      { once: true }
    );
  }
};

export default DiscourseContextOverlay;
