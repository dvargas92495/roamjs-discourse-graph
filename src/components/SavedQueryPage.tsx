import React from "react";
import ReactDOM from "react-dom";
import createQueryBuilderRender from "../utils/createQueryBuilderRender";

type Props = { pageUid: string };

const SavedQueryPage = ({ pageUid }: Props) => {
  const { QueryPage } = window.roamjs.extension.queryBuilder;
  return <QueryPage pageUid={pageUid} />;
};

export const render = createQueryBuilderRender(SavedQueryPage);

export default SavedQueryPage;
