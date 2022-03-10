import { Card } from "@blueprintjs/core";
import React, { useState } from "react";
import ReactDOM from "react-dom";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getSubTree from "roamjs-components/util/getSubTree";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import QueryEditor from "./QueryEditor";
import SavedQuery from "./SavedQuery";

type Props = { pageUid: string };

const SavedQueryPage = ({ pageUid }: Props) => {
  const [resultsReferenced, setResultsReferenced] = useState(new Set<string>());
  const [isEdit, setIsEdit] = useState(false);
  const [query, setQuery] = useState([]);
  return (
    <Card>
      {isEdit ? (
        <div>
          <QueryEditor
            parentUid={pageUid}
            defaultQuery={query}
            onQuery={({ returnNode, conditions, selections }) => {
              const tree = getBasicTreeByParentUid(pageUid);
              const queryNode = getSubTree({ tree, key: "query" });
              return (
                queryNode.uid
                  ? Promise.all(
                      queryNode.children.map((c) => deleteBlock(c.uid))
                    ).then(() => queryNode.uid)
                  : createBlock({
                      parentUid: pageUid,
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
                  return Promise.all(
                    nodes.map((node, order) =>
                      createBlock({ node, order, parentUid })
                    )
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
                  setIsEdit(false);
                });
            }}
          />
        </div>
      ) : (
        <SavedQuery
          uid={pageUid}
          isSavedToPage
          resultsReferenced={resultsReferenced}
          clearOnClick={console.log}
          setResultsReferenced={setResultsReferenced}
          editSavedQuery={(q) => {
            setQuery(q);
            setIsEdit(true);
          }}
        />
      )}
    </Card>
  );
};

export const render = ({ parent, ...props }: { parent: HTMLElement } & Props) =>
  ReactDOM.render(<SavedQueryPage {...props} />, parent);

export default SavedQueryPage;
