import {AliasRenderer} from "./alias";
import {AbstractAnnotationRenderer} from "./annotation";
import {AbstractConstraintRenderer} from "./constraint";
import {ExtensionRenderer} from "./extension";
import {FunctionTypeRenderer} from "./function";
import {GlobalRenderer} from "./global";
import {ModuleRenderer} from "./module";
import {ObjectTypeRenderer} from "./object";
import {OperatorTypeRenderer} from "./operator";
import {AbstractPointerRenderer} from "./pointer";
import {ScalarTypeRenderer} from "./scalar";

export const renderers = {
  Extension: ExtensionRenderer,
  Module: ModuleRenderer,
  Object: ObjectTypeRenderer,
  Scalar: ScalarTypeRenderer,
  Pointer: AbstractPointerRenderer,
  Constraint: AbstractConstraintRenderer,
  Function: FunctionTypeRenderer,
  Operator: OperatorTypeRenderer,
  Alias: AliasRenderer,
  Global: GlobalRenderer,
  AbstractAnnotation: AbstractAnnotationRenderer,
};
