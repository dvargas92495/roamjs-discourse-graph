import { Card } from "@blueprintjs/core";
import React, { useState } from "react";
import ReactDOM from "react-dom";
import SavedQuery from "./SavedQuery";

type Props = { pageUid: string };

const SavedQueryPage = ({ pageUid }: Props) => {
  const [resultsReferenced, setResultsReferenced] = useState(new Set<string>());
  return (
    <Card>
      <SavedQuery
        uid={pageUid}
        resultsReferenced={resultsReferenced}
        clearOnClick={console.log}
        setResultsReferenced={setResultsReferenced}
        editSavedQuery={console.log}
      />
    </Card>
  );
};

export const render = ({ parent, ...props }: { parent: HTMLElement } & Props) =>
  ReactDOM.render(<SavedQueryPage {...props} />, parent);

export default SavedQueryPage;
