import { H3 } from "@blueprintjs/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import ResizableDrawer from "./ResizableDrawer";
import SavedQuery from "./components/SavedQuery";
import createOverlayQueryBuilderRender from "./utils/createOverlayQueryBuilderRender";
import getSubTree from "roamjs-components/util/getSubTree";
import { PullBlock } from "roamjs-components/types/native";

type QueryBuilderResults = Parameters<
  typeof window.roamjs.extension.queryBuilder.ResultsView
>[0]["results"];

type Props = {
  blockUid: string;
  clearOnClick: (s: string) => void;
};

const SavedQueriesContainer = ({
  savedQueries,
  setSavedQueries,
  clearOnClick,
  setQuery,
}: {
  savedQueries: { uid: string; text: string; results?: QueryBuilderResults }[];
  setSavedQueries: (
    s: { uid: string; text: string; results?: QueryBuilderResults }[]
  ) => void;
  clearOnClick: (s: string) => void;
  setQuery: (s: string) => void;
}) => {
  const [resultsReferenced, setResultsReferenced] = useState(new Set<string>());
  const refreshResultsReferenced = useCallback(() => {
    return window.roamAlphaAPI.ui.mainWindow
      .getOpenPageOrBlockUid()
      .then(
        (uid) => uid || window.roamAlphaAPI.util.dateToPageTitle(new Date())
      )
      .then((pageUid) => {
        const title = getPageTitleByPageUid(pageUid);
        if (title.startsWith("Playground")) {
          return new Set(
            (
              window.roamAlphaAPI.data.fast.q(
                `[:find (pull ?c [:block/string]) :where 
            [?p :block/uid "${pageUid}"] 
            [?e :block/page ?p] 
            [?e :block/string "elements"]
            [?e :block/children ?c]]`
              ) as [PullBlock][]
            )
              .filter((a) => a.length && a[0])
              .map((a) => a[0][":block/string"])
          );
        }
        return new Set(
          (
            window.roamAlphaAPI.q(
              `[:find (pull ?r [:node/title]) :where 
            [?p :block/uid "${pageUid}"] 
            [?b :block/page ?p] 
            [?b :block/refs ?r]]`
            ) as [PullBlock][]
          )
            .filter((a) => a.length && a[0])
            .map((a) => a[0][":node/title"])
        );
      })
      .then(setResultsReferenced);
  }, [setResultsReferenced]);
  useEffect(() => {
    window.addEventListener("hashchange", refreshResultsReferenced);
    refreshResultsReferenced();
    return () =>
      window.removeEventListener("hashchange", refreshResultsReferenced);
  }, [refreshResultsReferenced]);
  return (
    <>
      <hr />
      <H3>Saved Queries</H3>
      {savedQueries.map((sq) => (
        <SavedQuery
          uid={sq.uid}
          key={sq.uid}
          clearOnClick={clearOnClick}
          onDelete={() => {
            setSavedQueries(savedQueries.filter((s) => s !== sq));
            deleteBlock(sq.uid);
          }}
          resultsReferenced={resultsReferenced}
          setResultsReferenced={setResultsReferenced}
          editSavedQuery={setQuery}
          initialResults={sq.results}
          onRefresh={refreshResultsReferenced}
        />
      ))}
    </>
  );
};

const QueryDrawerContent = ({
  clearOnClick,
  blockUid,
  ...exportRenderProps
}: Props) => {
  const tree = useMemo(() => getBasicTreeByParentUid(blockUid), []);
  const [savedQueries, setSavedQueries] = useState<
    { text: string; uid: string; results?: QueryBuilderResults }[]
  >(
    tree
      .filter((t) => !toFlexRegex("scratch").test(t.text))
      .map((t) => ({ text: t.text, uid: t.uid }))
  );
  const [savedQueryLabel, setSavedQueryLabel] = useState(
    `Query ${
      savedQueries.reduce(
        (prev, cur) =>
          prev < Number(cur.text.split(" ")[1])
            ? Number(cur.text.split(" ")[1])
            : prev,
        0
      ) + 1
    }`
  );

  const [query, setQuery] = useState(savedQueryLabel);
  const { QueryEditor, fireQuery, parseQuery } =
    window.roamjs.extension.queryBuilder;
  return (
    <>
      <QueryEditor
        key={query}
        parentUid={blockUid}
        onQuery={() => {
          return Promise.all([
            createBlock({
              node: {
                text: savedQueryLabel,
              },
              parentUid: blockUid,
            }).then((newSavedUid) =>
              createBlock({
                node: {
                  text: "scratch",
                },
                parentUid: newSavedUid,
              }).then((scratchUid) => ({ newSavedUid, scratchUid }))
            ),
            fireQuery(parseQuery(blockUid)),
          ]).then(([{ newSavedUid, scratchUid }, results]) =>
            Promise.all(
              getSubTree({ key: "scratch", parentUid: blockUid }).children.map(
                (c, order) =>
                  window.roamAlphaAPI.moveBlock({
                    location: {
                      "parent-uid": scratchUid,
                      order,
                    },
                    block: { uid: c.uid },
                  })
              )
            ).then(() => {
              setSavedQueries([
                { uid: newSavedUid, text: savedQueryLabel, results },
                ...savedQueries,
              ]);
              const nextQueryLabel = savedQueryLabel
                .split(" ")
                .map((s) => (s === "Query" ? s : `${Number(s) + 1}`))
                .join(" ");
              setSavedQueryLabel(nextQueryLabel);
              setQuery(nextQueryLabel);
            })
          );
        }}
      />
      {!!savedQueries.length && (
        <SavedQueriesContainer
          savedQueries={savedQueries}
          setSavedQueries={setSavedQueries}
          clearOnClick={clearOnClick}
          setQuery={setQuery}
          {...exportRenderProps}
        />
      )}
    </>
  );
};

const QueryDrawer = ({
  onClose,
  ...props
}: {
  onClose: () => void;
} & Props) => (
  <ResizableDrawer onClose={onClose} title={"Queries"}>
    <QueryDrawerContent {...props} />
  </ResizableDrawer>
);

export const render = createOverlayQueryBuilderRender<Props>(QueryDrawer);

export default QueryDrawer;
