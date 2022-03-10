import { Button } from "@blueprintjs/core";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import useSubTree from "roamjs-components/hooks/useSubTree";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getSubTree from "roamjs-components/util/getSubTree";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import { getNodes } from "../util";
import fireQuery from "../utils/fireQuery";
import parseQuery from "../utils/parseQuery";
import QueryEditor from "./QueryEditor";
import ResultsView, { Result } from "./ResultsView";

const NodeIndex = ({
  parentUid,
  node,
}: {
  parentUid: string;
  node: ReturnType<typeof getNodes>[number];
}) => {
  const [isEdit, setIsEdit] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const queryResults = useCallback<
    Parameters<typeof QueryEditor>[0]["onQuery"]
  >(
    ({ returnNode, conditions, selections }) => {
      const tree = getBasicTreeByParentUid(parentUid);
      const queryNode = getSubTree({ tree, key: "query" });
      return (
        queryNode.uid
          ? Promise.all(queryNode.children.map((c) => deleteBlock(c.uid))).then(
              () => queryNode.uid
            )
          : createBlock({
              parentUid,
              node: { text: "query" },
            })
      )
        .then((parentUid) => {
          const nodes = [
            { text: `Find ${returnNode} Where` },
            ...conditions.map((c) => ({
              text: `${c.source} ${c.relation} ${c.target}`,
            })),
            ...selections.map((s) => ({
              text: `Select ${s.text} AS ${s.label}`,
            })),
          ];
          setQuery(nodes.map((q) => q.text));
          return Promise.all(
            nodes.map((node, order) => createBlock({ node, order, parentUid }))
          );
        })
        .then(() =>
          Promise.all(
            conditions
              .map((c) => deleteBlock(c.uid))
              .concat(selections.map((s) => deleteBlock(s.uid)))
          )
        )
        .then(() => {
          setResults(fireQuery({ returnNode, conditions, selections }));
          setIsEdit(false);
        });
    },
    [setResults, setIsEdit]
  );
  const tree = useMemo(() => getBasicTreeByParentUid(parentUid), [parentUid]);
  const queryNode = useSubTree({ tree, key: "query" });
  const initialQuery = useMemo(
    () =>
      queryNode.uid
        ? queryNode.children.map((t) => t.text)
        : [`Find ${node.text} Where`],
    [queryNode, node]
  );
  const [query, setQuery] = useState(initialQuery);
  useEffect(() => {
    const { returnNode, conditionNodes, selectionNodes } =
      parseQuery(initialQuery);
    queryResults({
      returnNode,
      conditions: conditionNodes,
      selections: selectionNodes,
    });
  }, [queryResults, initialQuery]);
  return (
    <>
      <div style={{ marginBottom: 8, overflow: "scroll", paddingBottom: 8 }}>
        {isEdit ? (
          <QueryEditor
            parentUid={parentUid}
            onQuery={queryResults}
            defaultQuery={query}
            returnNodeDisabled
          />
        ) : (
          <Button
            minimal
            icon={"edit"}
            onClick={() => {
              setIsEdit(true);
            }}
          />
        )}
      </div>
      <ResultsView results={results} />
    </>
  );
};

export default NodeIndex;
