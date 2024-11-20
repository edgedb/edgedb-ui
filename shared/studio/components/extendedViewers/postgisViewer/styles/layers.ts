import type {LayerSpecification} from "maplibre-gl";

// Modified from https://github.com/openmaptiles/positron-gl-style
import _lightLayers from "./light_layers.json";
// Modified from https://github.com/openmaptiles/dark-matter-gl-style
import _darkLayers from "./dark_layers.json";

export const lightLayers = _lightLayers as LayerSpecification[];
export const darkLayers = _darkLayers as LayerSpecification[];
