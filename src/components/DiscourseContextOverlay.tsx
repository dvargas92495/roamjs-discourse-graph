import { Button, Popover, Position, Tooltip } from "@blueprintjs/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { ContextContent } from "../DiscourseContext";
import {
  findDiscourseNode,
  getDiscourseContextResults,
  getNodes,
  getRelations,
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
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { getNodeEnv } from "roamjs-components/util/env";

type DiscourseData = {
  results: Awaited<ReturnType<typeof getDiscourseContextResults>>;
  refs: number;
};

const cache: {
  [title: string]: DiscourseData;
} = {};
const overlayQueue: {
  tag: string;
  callback: () => Promise<void>;
  start: number;
  queued: number;
  end: number;
  mid: number;
  id: string;
}[] = [];

if (getNodeEnv() === "development") {
  document.body.addEventListener("roamjs:discourse-graph:loaded", () => {
    window.roamjs.extension.discourseGraph = {
      ...(window.roamjs.extension.discourseGraph || {}),
      overlayQueue,
      getDiscourseContextResults: (
        args: { uid: string } | { title: string }
      ) => {
        const uid =
          "uid" in args ? args.uid : getPageUidByPageTitle(args.title);
        window.roamjs.extension.discourseGraph[uid] = {
          start: new Date().valueOf(),
        };
        return getDiscourseContextResults({ uid, ignoreCache: true }).then(
          (res) => {
            // @ts-ignore
            window.roamjs.extension.discourseGraph[uid].end =
              new Date().valueOf();
            return res;
          }
        );
      },
    };
  });
}

const getOverlayInfo = (tag: string, id: string): Promise<DiscourseData> => {
  if (cache[tag]) return Promise.resolve(cache[tag]);
  const relations = getRelations();
  const nodes = getNodes(relations);
  return new Promise((resolve) => {
    const triggerNow = overlayQueue.length === 0;
    overlayQueue.push({
      id,
      start: 0,
      end: 0,
      mid: 0,
      queued: new Date().valueOf(),
      callback() {
        const self = this;
        const start = (self.start = new Date().valueOf());
        return getDiscourseContextResults({
          uid: getPageUidByPageTitle(tag),
          nodes,
          relations,
        }).then(function resultCallback(results) {
          self.mid = new Date().valueOf();
          const output = (cache[tag] = {
            results,
            refs: window.roamAlphaAPI.data.fast.q(
              `[:find ?a :where [?b :node/title "${normalizePageTitle(
                tag
              )}"] [?a :block/refs ?b]]`
            ).length,
          });
          const runTime = (self.end = new Date().valueOf() - start);
          setTimeout(() => {
            overlayQueue.splice(0, 1);
            if (overlayQueue.length) {
              overlayQueue[0].callback();
            }
          }, runTime * 4);
          resolve(output);
        });
      },
      tag,
    });
    if (triggerNow) overlayQueue[0].callback?.();
  });
};

const experimentalGetOverlayInfo = (title: string) =>
  Promise.all([
    getDiscourseContextResults({ uid: getPageUidByPageTitle(title) }),
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
  const tagUid = useMemo(() => getPageUidByPageTitle(tag), [tag]);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<DiscourseData["results"]>([]);
  const [refs, setRefs] = useState(0);
  const [score, setScore] = useState<number | string>(0);
  const getInfo = useCallback(
    () =>
      (localStorageGet("experimental") === "true"
        ? experimentalGetOverlayInfo(tag)
        : getOverlayInfo(tag, id)
      )
        .then(({ refs, results }) => {
          const discourseNode = findDiscourseNode(tagUid);
          if (discourseNode) {
            const attribute = getSettingValueFromTree({
              tree: getBasicTreeByParentUid(discourseNode.type),
              key: "Overlay",
              defaultValue: "Overlay",
            });
            return deriveNodeAttribute({ uid: tagUid, attribute }).then(
              (score) => {
                setResults(results);
                setRefs(refs);
                setScore(score);
              }
            );
          }
        })
        .finally(() => setLoading(false)),
    [tag, setResults, setLoading, setRefs, setScore]
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
            position: "relative",
          }}
        >
          <ContextContent uid={tagUid} results={results} />
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
