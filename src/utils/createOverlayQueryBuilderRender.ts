import React from "react";
import ReactDOM from "react-dom";
import getRenderRoot from "roamjs-components/util/getRenderRoot";

const createQueryBuilderRender = <T>(
  Component: (props: T) => React.ReactElement
) => {
  return (props: T) => {
    const parent = getRenderRoot("query-drawer");
    const onClose = () => {
      ReactDOM.unmountComponentAtNode(parent);
      parent.remove();
    };
    const render = () =>
      ReactDOM.render(
        React.createElement(Component, {
          ...props,
          onClose,
        }),
        parent
      );
    if (window.roamjs.extension.queryBuilder) {
      render();
    } else {
      document.body.addEventListener(
        "roamjs:discourse-graph:query-builder",
        render,
        { once: true }
      );
    }
    return onClose;
  };
};

export default createQueryBuilderRender;
