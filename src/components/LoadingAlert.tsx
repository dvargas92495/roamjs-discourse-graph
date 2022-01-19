import { Alert, Spinner, SpinnerSize } from "@blueprintjs/core";
import React, { useEffect } from "react";
import createOverlayRender from "roamjs-components/util/createOverlayRender";

type Props = {
  operation: () => Promise<unknown> | void;
  content: React.ReactNode;
};

const LoadingAlert = ({
  onClose,
  operation,
  content,
}: {
  onClose: () => void;
} & Props) => {
  useEffect(() => {
    setTimeout(() => {
      const result = operation();
      if (result) {
        result.finally(onClose);
      } else {
        onClose();
      }
    }, 1);
  }, [operation, onClose]);
  return (
    <>
      <style>
        {`.roamjs-loading-alert .bp3-alert-footer {
  display: none;
}

.roamjs-loading-alert .bp3-alert-contents {
  margin:auto;
}

.roamjs-loading-alert.bp3-alert {
  max-width: fit-content;
}`}
      </style>
      <Alert
        isOpen={true}
        onClose={onClose}
        confirmButtonText={""}
        className={"roamjs-loading-alert"}
      >
        <div>{content}</div>
        <Spinner size={SpinnerSize.STANDARD} />
      </Alert>
    </>
  );
};

export const render = createOverlayRender<Props>("loading-alert", LoadingAlert);

export default LoadingAlert;
