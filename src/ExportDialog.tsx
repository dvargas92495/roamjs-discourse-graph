import React, { useMemo, useState } from "react";
import createOverlayQueryBuilderRender from "./utils/createOverlayQueryBuilderRender";
import {
  ExportDialogComponent,
  Result,
} from "roamjs-components/types/query-builder";
import getExportTypes from "./utils/getExportTypes";
import { getNodes, matchNode } from "./util";
import type { PullBlock } from "roamjs-components/types";
import { Checkbox } from "@blueprintjs/core";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getSubTree from "roamjs-components/util/getSubTree";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";

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
  const exportArgs = useMemo(() => {
    if (fromQuery) return fromQuery;
    const discourseNodes = getNodes();
    return {
      nodes: (isBackendEnabled: boolean) =>
        Promise.all(
          discourseNodes.map((d) =>
            window.roamjs.extension.queryBuilder.fireQuery({
              returnNode: "node",
              conditions: [
                {
                  relation: "is a",
                  source: "node",
                  target: d.type,
                  uid: window.roamAlphaAPI.util.generateUID(),
                  type: "clause",
                },
              ],
              selections: [],
              isBackendEnabled,
            })
          )
        ).then((r) => r.flat()),
      relations: undefined,
    };
  }, [fromQuery]);
  return (
    <>
      <QBExportDialog
        isOpen={true}
        onClose={onClose}
        results={exportArgs.nodes}
        exportTypes={getExportTypes({
          results: exportArgs.nodes,
          relations: exportArgs.relations,
        })}
      />
    </>
  );
};

export const render = createOverlayQueryBuilderRender<Props>(ExportDialog);

export type ExportRenderProps = Omit<Parameters<typeof render>[0], "fromQuery">;

export default ExportDialog;
