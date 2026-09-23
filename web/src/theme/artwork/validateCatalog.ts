import {
	ARTWORK_ROLES,
	ARTWORK_TOUCH_IDS,
	type ArtworkAlias,
	type ArtworkDefinition,
	type ArtworkRole,
	type ArtworkTouchId,
} from "./types";

const TOUCH_FORMAT: Record<
	ArtworkTouchId,
	readonly ["svg" | "webp", "mask" | "none"]
> = {
	woodcut: ["svg", "mask"],
	pencil: ["svg", "mask"],
	engraving: ["svg", "mask"],
	"cut-paper": ["svg", "none"],
	brush: ["svg", "mask"],
	"ink-wash": ["webp", "none"],
	gouache: ["webp", "none"],
	risograph: ["svg", "none"],
	screenprint: ["svg", "none"],
	pixel: ["svg", "none"],
	technical: ["svg", "mask"],
	chalk: ["webp", "none"],
};

const ROLE_ASPECT: Record<ArtworkRole, number> = {
	hero: 3 / 2,
	medium: 1,
	frame: 4 / 3,
	heading: 8,
	tab: 3,
	label: 2,
	rule: 32,
	panel: 4 / 3,
	"straight-arrow": 3,
	"turn-arrow": 3,
	route: 1 / 2,
	"season-pattern": 1,
};

const ROLE_MAX_PRINT_WIDTH_MM: Record<ArtworkRole, number> = {
	hero: 128,
	medium: 42,
	frame: 128,
	heading: 128,
	tab: 128,
	label: 128,
	rule: 128,
	panel: 128,
	"straight-arrow": 128,
	"turn-arrow": 128,
	route: 30,
	"season-pattern": 40,
};

const EXPECTED_SUBJECTS: Record<ArtworkRole, readonly string[]> = {
	hero: [
		"mountain",
		"sea",
		"street",
		"machiya-grid",
		"urban-window-railway",
		"roof-arch",
	],
	medium: [
		"train",
		"airplane",
		"car",
		"bag",
		"tableware",
		"leaf",
		"flower",
		"shell",
	],
	frame: ["photo-frame"],
	heading: ["heading-band"],
	tab: ["sticky-note"],
	label: ["ticket-label"],
	rule: ["measurement-rule"],
	panel: ["grid-panel"],
	"straight-arrow": ["straight-arrow"],
	"turn-arrow": ["turn-arrow"],
	route: ["route"],
	"season-pattern": ["season-pattern"],
};
const EXPECTED_ROLE_COUNTS: Record<ArtworkRole, number> = {
	hero: 6,
	medium: 8,
	frame: 1,
	heading: 1,
	tab: 1,
	label: 1,
	rule: 1,
	panel: 1,
	"straight-arrow": 1,
	"turn-arrow": 1,
	route: 1,
	"season-pattern": 1,
};

export type ArtworkValidationOptions = Readonly<{
	aliases?: readonly ArtworkAlias[];
	/** Vite URL imports, keyed by the exact sourcePath. */
	bundledUrls?: Readonly<Record<string, string>>;
	/** Raw SVGs are supplied by production tests only; never imported by the app. */
	svgSources?: Readonly<Record<string, string>>;
	requireReviewed?: boolean;
	requireComplete?: boolean;
}>;

const positive = (value: number) => Number.isFinite(value) && value > 0;
const close = (actual: number, expected: number) =>
	Math.abs(actual - expected) <= Math.max(0.0001, expected * 0.001);
const minimumPixels = (mm: number) => Math.ceil((mm / 25.4) * 300);

/** Collects every production error so artists can correct a whole batch at once. */
export function validateArtworkCatalog(
	definitions: readonly ArtworkDefinition[],
	options: ArtworkValidationOptions = {},
): string[] {
	const errors: string[] = [];
	const byId = new Map<string, ArtworkDefinition>();
	const sourcePaths = new Set<string>();
	const groupMembers = new Map<string, ArtworkDefinition[]>();
	for (const artwork of definitions) {
		const label = artwork.id || "<empty id>";
		if (!artwork.id || byId.has(artwork.id)) {
			errors.push(`${label}: duplicate or empty artwork ID`);
		}
		byId.set(artwork.id, artwork);
		if (sourcePaths.has(artwork.sourcePath)) {
			errors.push(`${label}: duplicate sourcePath`);
		}
		sourcePaths.add(artwork.sourcePath);
		const [format, recolor] = TOUCH_FORMAT[artwork.touchId] ?? [];
		if (!format || artwork.format !== format || artwork.recolor !== recolor) {
			errors.push(`${label}: touch format/recolor mismatch`);
		}
		if (!ARTWORK_ROLES.includes(artwork.role)) {
			errors.push(`${label}: unknown role`);
		}
		if (!Number.isInteger(artwork.revision) || artwork.revision < 1) {
			errors.push(`${label}: invalid revision`);
		}
		if (
			!positive(artwork.width) ||
			!positive(artwork.height) ||
			!positive(artwork.aspect) ||
			!close(artwork.aspect, artwork.width / artwork.height)
		) {
			errors.push(`${label}: dimensions/aspect mismatch`);
		}
		if (
			ROLE_ASPECT[artwork.role] &&
			!close(artwork.aspect, ROLE_ASPECT[artwork.role])
		) {
			errors.push(`${label}: role aspect mismatch`);
		}
		const expectedPath = `../../assets/artwork/${artwork.touchId}/${artwork.subjectId}-${artwork.role}.${artwork.format}`;
		if (artwork.sourcePath !== expectedPath) {
			errors.push(`${label}: sourcePath must name a bundled artwork file`);
		}
		if (
			!positive(artwork.minPrintWidthMm) ||
			!positive(artwork.maxPrintWidthMm) ||
			artwork.minPrintWidthMm > artwork.maxPrintWidthMm ||
			artwork.maxPrintWidthMm > (ROLE_MAX_PRINT_WIDTH_MM[artwork.role] ?? 0)
		) {
			errors.push(`${label}: invalid print width range`);
		}
		const inset = artwork.safeInset;
		if (
			!inset ||
			Object.values(inset).some(
				(v) => !Number.isFinite(v) || v < 0 || v >= 1,
			) ||
			inset.left + inset.right >= 1 ||
			inset.top + inset.bottom >= 1
		) {
			errors.push(`${label}: invalid safe inset`);
		}
		if (
			!artwork.subjectId ||
			!artwork.originalityGroupId ||
			!artwork.provenance.creator ||
			!artwork.provenance.method ||
			!artwork.provenance.licenseEvidence
		) {
			errors.push(
				`${label}: missing subject, originality group, or provenance`,
			);
		}
		if (options.requireReviewed && !artwork.reviewId?.trim()) {
			errors.push(`${label}: artwork is not reviewed`);
		}
		if (artwork.format === "webp") {
			if (typeof artwork.hasAlpha !== "boolean") {
				errors.push(`${label}: WebP alpha flag is missing`);
			}
			if (artwork.width < minimumPixels(artwork.maxPrintWidthMm)) {
				errors.push(
					`${label}: WebP has less than 300 dpi at maximum print width`,
				);
			}
		}
		const viewIds = new Set<string>();
		for (const view of artwork.views ?? []) {
			if (
				!view.id ||
				viewIds.has(view.id) ||
				!Number.isFinite(view.x) ||
				!Number.isFinite(view.y) ||
				view.x < 0 ||
				view.y < 0 ||
				!positive(view.width) ||
				!positive(view.height) ||
				view.x + view.width > artwork.width ||
				view.y + view.height > artwork.height
			) {
				errors.push(`${label}: invalid or duplicate view ${view.id}`);
			}
			viewIds.add(view.id);
			if (
				artwork.format === "webp" &&
				view.width < minimumPixels(artwork.maxPrintWidthMm)
			) {
				errors.push(`${label}: view ${view.id} has less than 300 dpi`);
			}
		}
		if (
			artwork.role === "season-pattern" &&
			!["spring", "summer", "autumn", "winter"].every((id) => viewIds.has(id))
		) {
			errors.push(`${label}: four season views are required`);
		}
		if (
			artwork.touchId === "chalk" &&
			artwork.role === "panel" &&
			!viewIds.has("film")
		) {
			errors.push(`${label}: film powder view is required`);
		}
		const url = options.bundledUrls?.[artwork.sourcePath];
		if (options.bundledUrls && (!url || /^(?:https?:)?\/\//i.test(url))) {
			errors.push(`${label}: missing or external bundled URL`);
		}
		const source = options.svgSources?.[artwork.sourcePath];
		if (options.svgSources && artwork.format === "svg") {
			if (!source) {
				errors.push(`${label}: missing SVG source`);
			} else {
				validateSvgSource(label, artwork, source, errors);
			}
		}
		const group = groupMembers.get(artwork.originalityGroupId) ?? [];
		group.push(artwork);
		groupMembers.set(artwork.originalityGroupId, group);
	}
	for (const [groupId, members] of groupMembers) {
		if (
			members.some(
				(member) =>
					member.touchId !== members[0]?.touchId ||
					member.subjectId !== members[0]?.subjectId,
			)
		) {
			errors.push(
				`${groupId}: originality group spans different touch/subject`,
			);
		}
	}
	validateAliases(byId, options.aliases ?? [], errors);
	if (options.requireComplete) {
		for (const touchId of ARTWORK_TOUCH_IDS) {
			for (const role of ARTWORK_ROLES) {
				const reviewed = definitions.filter(
					(artwork) =>
						artwork.touchId === touchId &&
						artwork.role === role &&
						artwork.reviewId?.trim(),
				);
				const groups = new Set(
					reviewed.map((artwork) => artwork.originalityGroupId),
				);
				const subjects = reviewed.map((artwork) => artwork.subjectId).sort();
				const expectedSubjects = [...EXPECTED_SUBJECTS[role]].sort();
				if (subjects.join("\0") !== expectedSubjects.join("\0")) {
					errors.push(
						`${touchId}/${role}: required subjects are missing, duplicated, or unexpected`,
					);
				}
				if (groups.size !== EXPECTED_ROLE_COUNTS[role]) {
					errors.push(
						`${touchId}/${role}: expected ${EXPECTED_ROLE_COUNTS[role]} reviewed original groups, got ${groups.size}`,
					);
				}
			}
		}
		if (groupMembers.size !== 288) {
			errors.push(`expected 288 original groups, got ${groupMembers.size}`);
		}
	}
	return errors;
}

function validateAliases(
	byId: ReadonlyMap<string, ArtworkDefinition>,
	aliases: readonly ArtworkAlias[],
	errors: string[],
): void {
	const targets = new Map<string, string>();
	for (const alias of aliases) {
		if (!alias.id || targets.has(alias.id) || byId.has(alias.id)) {
			errors.push(`${alias.id}: duplicate or conflicting alias`);
		}
		targets.set(alias.id, alias.targetId);
	}
	for (const id of targets.keys()) {
		const seen = new Set<string>();
		let current = id;
		while (targets.has(current)) {
			if (seen.has(current)) {
				errors.push(`${id}: alias cycle`);
				break;
			}
			seen.add(current);
			current = targets.get(current) ?? "";
		}
		if (!seen.has(current) && !byId.has(current)) {
			errors.push(`${id}: alias target is missing`);
		}
	}
}

function validateSvgSource(
	label: string,
	artwork: ArtworkDefinition,
	source: string,
	errors: string[],
): void {
	if (
		/<(?:text|tspan|script|use|foreignObject|image|iframe|object|embed)\b/i.test(
			source,
		) ||
		/\bxlink:href\b/i.test(source) ||
		/\bhref\s*=\s*["'](?!#)/i.test(source) ||
		/\burl\(\s*(?!["']?#)[^)]+/i.test(source) ||
		/@import|<!DOCTYPE|<!ENTITY/i.test(source)
	) {
		errors.push(`${label}: forbidden SVG element or external reference`);
	}

	// White is meaningful inside an SVG mask, where it defines the visible area.
	// Outside the mask it becomes an opaque rectangle when used as a CSS mask.
	const visibleSource = source.replace(
		/<mask\b[^>]*>[\s\S]*?<\/mask\s*>/gi,
		"",
	);
	if (
		artwork.recolor === "mask" &&
		/\b(?:fill|stroke)\s*=\s*["'](?:white|#fff(?:fff)?)(?=["'])/i.test(
			visibleSource,
		)
	) {
		errors.push(`${label}: opaque white paint defeats an alpha mask`);
	}
	const match = /\bviewBox\s*=\s*["']([^"']+)["']/i.exec(source);
	const box = match?.[1]
		?.trim()
		.split(/[\s,]+/)
		.map(Number);
	if (
		box?.length !== 4 ||
		box.some((value) => !Number.isFinite(value)) ||
		box[0] !== 0 ||
		box[1] !== 0 ||
		!close(box[2] ?? 0, artwork.width) ||
		!close(box[3] ?? 0, artwork.height)
	) {
		errors.push(`${label}: SVG viewBox/dimensions mismatch`);
	}
}

export function assertArtworkCatalog(
	definitions: readonly ArtworkDefinition[],
	options: ArtworkValidationOptions = {},
): void {
	const errors = validateArtworkCatalog(definitions, options);
	if (errors.length) {
		throw new Error(`Artwork catalog is invalid:\n${errors.join("\n")}`);
	}
}
