import React from "react";
import createQueryBuilderRender from "../utils/createQueryBuilderRender";
import getExportTypes from "../utils/getExportTypes";

type Props = { pageUid: string };

const SavedQueryPage = ({ pageUid }: Props) => {
  const { QueryPage } = window.roamjs.extension.queryBuilder;
  return (
    <QueryPage
      pageUid={pageUid}
      getExportTypes={(results) => getExportTypes({ results })}
    />
  );
};

export const render = createQueryBuilderRender(SavedQueryPage);

export default SavedQueryPage;
