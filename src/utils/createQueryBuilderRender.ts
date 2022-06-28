import React from "react";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";

const createQueryBuilderRender = <T>(
  Component: (props: T) => React.ReactElement
) => {
  return (props: { parent: HTMLElement } & T) => {
    const actualRender = () =>
      renderWithUnmount(React.createElement(Component, props), props.parent);
    if (window.roamjs.extension.queryBuilder) {
      actualRender();
    } else {
      document.body.addEventListener(
        "roamjs:discourse-graph:query-builder",
        actualRender,
        { once: true }
      );
    }
  };
};

export default createQueryBuilderRender;
