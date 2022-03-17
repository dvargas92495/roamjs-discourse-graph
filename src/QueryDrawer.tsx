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
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import toRoamDateUid from "roamjs-components/date/toRoamDateUid";
import createOverlayRender from "roamjs-components/util/createOverlayRender";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import ResizableDrawer from "./ResizableDrawer";
import { Result as SearchResult } from "./components/ResultsView";
import SavedQuery from "./components/SavedQuery";
import createQueryBuilderRender from "./utils/createQueryBuilderRender";
import ReactDOM from "react-dom";
import getRenderRoot from "roamjs-components/util/getRenderRoot";

type Props = {
  blockUid: string;
  clearOnClick: (s: string, m: string) => void;
};

const SavedQueriesContainer = ({
  savedQueries,
  setSavedQueries,
  clearOnClick,
  setQuery,
}: {
  savedQueries: { uid: string; text: string; results?: SearchResult[] }[];
  setSavedQueries: (
    s: { uid: string; text: string; results?: SearchResult[] }[]
  ) => void;
  clearOnClick: (s: string, t: string) => void;
  setQuery: (s: string[]) => void;
}) => {
  const refreshResultsReferenced = useCallback(
    (pageUid = getCurrentPageUid()) => {
      const title = getPageTitleByPageUid(pageUid);
      if (title.startsWith("Playground")) {
        return new Set(
          window.roamAlphaAPI
            .q(
              `[:find (pull ?c [:block/string]) :where 
            [?p :block/uid "${pageUid}"] 
            [?e :block/page ?p] 
            [?e :block/string "elements"] 
            [?e :block/children ?c]]`
            )
            .filter((a) => a.length && a[0])
            .map((a) => a[0].string)
        );
      }
      return new Set(
        window.roamAlphaAPI
          .q(
            `[:find (pull ?r [:node/title]) :where 
            [?p :block/uid "${pageUid}"] 
            [?b :block/page ?p] 
            [?b :block/refs ?r]]`
          )
          .filter((a) => a.length && a[0])
          .map((a) => a[0].title)
      );
    },
    []
  );
  const [resultsReferenced, setResultsReferenced] = useState(
    refreshResultsReferenced
  );
  const hashChangeListener = useCallback(
    (e: HashChangeEvent) =>
      setResultsReferenced(
        refreshResultsReferenced(
          e.newURL.match(/\/page\/(.*)$/)?.[1] || toRoamDateUid(new Date())
        )
      ),
    [refreshResultsReferenced, setResultsReferenced]
  );
  useEffect(() => {
    window.addEventListener("hashchange", hashChangeListener);
    return () => window.removeEventListener("hashchange", hashChangeListener);
  }, [hashChangeListener]);
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
    { text: string; uid: string; results?: SearchResult[] }[]
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

  const [query, setQuery] = useState<string[]>([]);
  const { QueryEditor, fireQuery } = window.roamjs.extension.queryBuilder;
  return (
    <>
      <QueryEditor
        parentUid={blockUid}
        defaultQuery={query}
        onQuery={({ returnNode, conditions, selections }) => {
          const results = fireQuery({ returnNode, conditions, selections });
          return createBlock({
            node: {
              text: savedQueryLabel,
              children: [
                {
                  text: "query",
                  children: [
                    { text: `Find ${returnNode} Where` },
                    ...conditions.map((c) => ({
                      text: `${c.source} ${c.relation} ${c.target}`,
                    })),
                    ...selections.map((s) => ({
                      text: `Select ${s.text} AS ${s.label}`,
                    })),
                  ],
                },
              ],
            },
            parentUid: blockUid,
          }).then((newSavedUid) =>
            Promise.all(
              conditions
                .map((c) => deleteBlock(c.uid))
                .concat(selections.map((s) => deleteBlock(s.uid)))
            ).then(() => {
              setSavedQueries([
                { uid: newSavedUid, text: savedQueryLabel, results },
                ...savedQueries,
              ]);
              setSavedQueryLabel(
                // temporary
                savedQueryLabel
                  .split(" ")
                  .map((s) => (s === "Query" ? s : `${Number(s) + 1}`))
                  .join(" ")
              );
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

export const render = (props: Props) => {
  const parent = getRenderRoot("query-drawer");
  const onClose = () => {
    ReactDOM.unmountComponentAtNode(parent);
    parent.remove();
  };
  const render = () =>
    ReactDOM.render(
      React.createElement(QueryDrawer, {
        ...props,
        onClose,
      }),
      parent
    );
  if (window.roamjs.extension.queryBuilder) {
    render();
  } else {
    document.body.addEventListener("roamjs:query-builder:loaded", render, true);
  }
  return onClose;
};

export default QueryDrawer;
