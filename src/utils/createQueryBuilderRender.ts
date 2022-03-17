import React, { Component } from "react";
import ReactDOM from "react-dom";

const createQueryBuilderRender = <T>(
  Component: (props: T) => React.ReactElement
) => {
  return (props: { parent: HTMLElement } & T) => {
    const actualRender = () =>
      ReactDOM.render(React.createElement(Component, props), props.parent);
    if (window.roamjs.extension.queryBuilder) {
      actualRender();
    } else {
      document.body.addEventListener(
        "roamjs:query-builder:loaded",
        actualRender,
        true
      );
    }
  };
};

export default createQueryBuilderRender;
