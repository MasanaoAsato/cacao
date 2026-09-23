import type { ArtworkDefinition } from "../../theme/artwork/types";
import { ARTWORK_MANIFEST as brush } from "./brush/manifest";
import { ARTWORK_MANIFEST as chalk } from "./chalk/manifest";
import { ARTWORK_MANIFEST as cut_paper } from "./cut-paper/manifest";
import { ARTWORK_MANIFEST as engraving } from "./engraving/manifest";
import { ARTWORK_MANIFEST as gouache } from "./gouache/manifest";
import { ARTWORK_MANIFEST as ink_wash } from "./ink-wash/manifest";
import { ARTWORK_MANIFEST as pencil } from "./pencil/manifest";
import { ARTWORK_MANIFEST as pixel } from "./pixel/manifest";
import { ARTWORK_MANIFEST as risograph } from "./risograph/manifest";
import { ARTWORK_MANIFEST as screenprint } from "./screenprint/manifest";
import { ARTWORK_MANIFEST as technical } from "./technical/manifest";
import { ARTWORK_MANIFEST as woodcut } from "./woodcut/manifest";

/** Authored artwork catalog fragments; unreviewed entries remain drafts. */
export const ARTWORK_MANIFEST: readonly ArtworkDefinition[] = [
	...technical,
	...woodcut,
	...pencil,
	...engraving,
	...cut_paper,
	...brush,
	...risograph,
	...screenprint,
	...pixel,
	...ink_wash,
	...gouache,
	...chalk,
];
