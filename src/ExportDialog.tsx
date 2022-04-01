import React from "react";
import { BLOCK_REF_REGEX } from "roamjs-components/dom/constants";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import { TreeNode, ViewType } from "roamjs-components/types";
import createOverlayQueryBuilderRender from "./utils/createOverlayQueryBuilderRender";
import { Result } from "roamjs-components/types/query-builder";
import getExportTypes from "./utils/getExportTypes";

type Props = {
  fromQuery?: {
    nodes?: Result[];
    relations?: {
      target: string;
      source: string;
      label: string;
    }[];
  };
};

const ExportDialog = ({
  onClose,
  fromQuery,
}: {
  onClose: () => void;
} & Props) => {
  const QBExportDialog = window.roamjs.extension.queryBuilder.ExportDialog;
  return (
    <QBExportDialog
      isOpen={true}
      onClose={onClose}
      results={fromQuery.nodes}
      exportTypes={getExportTypes({
        results: fromQuery.nodes,
        relations: fromQuery.relations,
      })}
    />
  );
};

export const render = createOverlayQueryBuilderRender<Props>(ExportDialog);

export type ExportRenderProps = Omit<Parameters<typeof render>[0], "fromQuery">;

export default ExportDialog;
