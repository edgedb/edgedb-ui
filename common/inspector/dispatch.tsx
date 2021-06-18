import React from "react";

import assertNever from "assert-never";

import {_introspect, _ICodec} from "edgedb";

import styles from "./inspector.module.scss";

import Iterable from "./iterable";
import NamedTuple from "./namedtuple";
import Object from "./object";
import Scalar from "./scalar";

interface InspectorProps {
  value: any[];
  level: number;
  comma: boolean;
  label?: JSX.Element;
  codec: _ICodec;
}

class InspectorDispatch extends React.Component<
  InspectorProps,
  {renderingError: boolean}
> {
  constructor(props: InspectorProps) {
    super(props);
    this.state = {renderingError: false};
  }

  static getDerivedStateFromError() {
    return {renderingError: true};
  }

  render() {
    if (this.state.renderingError) {
      return (
        <div className={styles.rendering_error}>[Error rendering value]</div>
      );
    }

    const {value, level, label, comma, codec} = this.props;

    if (value == null) {
      return (
        <Scalar
          label={label}
          value={value}
          level={level}
          comma={comma}
          codec={codec}
        />
      );
    }

    const kind = _introspect(value);

    if (kind == null) {
      return (
        <Scalar
          label={label}
          value={value}
          level={level}
          comma={comma}
          codec={codec}
        />
      );
    }

    switch (kind.kind) {
      case "array":
        return (
          <Iterable
            label={label}
            value={value}
            level={level}
            comma={comma}
            codec={codec}
            kind="Array"
            braces="[]"
          />
        );
      case "set":
        return (
          <Iterable
            label={label}
            value={value}
            level={level}
            comma={comma}
            codec={codec}
            kind="Set"
            braces="{}"
          />
        );
      case "tuple":
        return (
          <Iterable
            label={label}
            value={value}
            level={level}
            comma={comma}
            codec={codec}
            kind="Tuple"
            braces="()"
          />
        );
      case "namedtuple":
        return (
          <NamedTuple
            comma={comma}
            label={label}
            value={value}
            level={level}
            codec={codec}
          />
        );
      case "object":
        return (
          <Object
            comma={comma}
            label={label}
            value={value}
            level={level}
            codec={codec}
          />
        );
      default:
        assertNever(kind);
    }
  }
}

export default InspectorDispatch;
