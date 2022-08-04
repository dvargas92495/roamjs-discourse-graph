import React, { useMemo } from "react";
import createOverlayQueryBuilderRender from "./utils/createOverlayQueryBuilderRender";
import { Result } from "roamjs-components/types/query-builder";
import getExportTypes from "./utils/getExportTypes";
import { getNodes, matchNode } from "./util";
import type { PullBlock } from "roamjs-components/types";

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
      nodes: window.roamAlphaAPI.data.fast
        .q(
          `[:find (pull ?p [:node/title :block/uid]) :where [?p :node/title _]]`
        )
        .map((a) => a[0] as PullBlock)
        .map((a) => ({
          text: a[":node/title"] as string,
          uid: a[":block/uid"] as string,
        }))
        .filter((a) =>
          discourseNodes.some((n) => matchNode({ title: a.text || "", ...n }))
        ),
      relations: undefined,
    };
  }, [fromQuery]);
  return (
    <QBExportDialog
      isOpen={true}
      onClose={onClose}
      results={exportArgs.nodes}
      exportTypes={getExportTypes({
        results: exportArgs.nodes,
        relations: exportArgs.relations,
      })}
    />
  );
};

export const render = createOverlayQueryBuilderRender<Props>(ExportDialog);

export type ExportRenderProps = Omit<Parameters<typeof render>[0], "fromQuery">;

export default ExportDialog;
