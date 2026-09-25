import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { generatePublishedArtworkUrls } from "./generatePublishedArtworkUrls.mjs";

function fixture(t, records) {
	const root = mkdtempSync(join(tmpdir(), "cacao-published-artwork-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const artwork = join(root, "src/assets/artwork/woodcut");
	const reviews = join(root, "src/theme/reviews");
	const output = join(root, "src/theme/artwork");
	for (const folder of [artwork, reviews, output])
		mkdirSync(folder, { recursive: true });
	writeFileSync(join(artwork, "one.svg"), "<svg/>");
	writeFileSync(join(artwork, "two.svg"), "<svg/>");
	writeFileSync(
		join(artwork, "manifest.ts"),
		`export const ARTWORK_MANIFEST = [
		{ id: "woodcut-one-r1", sourcePath: "../../assets/artwork/woodcut/one.svg" },
		{ id: "woodcut-two-r1", sourcePath: "../../assets/artwork/woodcut/two.svg" },
	];`,
	);
	writeFileSync(join(reviews, "artwork.json"), JSON.stringify(records));
	return { root, output: join(output, "publishedUrls.ts") };
}

test("正常系: activeだけをURL importへ生成し、reviewed素材は除く", (t) => {
	const { root, output } = fixture(t, [
		{ id: "woodcut-one-r1", status: "active" },
		{ id: "woodcut-two-r1", status: "reviewed" },
	]);
	generatePublishedArtworkUrls(root);
	const source = readFileSync(output, "utf8");
	assert.match(
		source,
		/import published0 from "\.\.\/\.\.\/assets\/artwork\/woodcut\/one\.svg\?url"/,
	);
	assert.doesNotMatch(source, /two\.svg\?url/);
});

test("異常系: manifestにないactive素材や重複IDを拒否する", (t) => {
	const unknown = fixture(t, [{ id: "unknown", status: "active" }]);
	assert.throws(
		() => generatePublishedArtworkUrls(unknown.root),
		/manifestにありません/,
	);
	const duplicate = fixture(t, [
		{ id: "woodcut-one-r1", status: "active" },
		{ id: "woodcut-one-r1", status: "active" },
	]);
	assert.throws(() => generatePublishedArtworkUrls(duplicate.root), /重複/);
});

test("境界値系: activeが0件ならURL importを生成しない", (t) => {
	const { root, output } = fixture(t, []);
	generatePublishedArtworkUrls(root);
	assert.doesNotMatch(readFileSync(output, "utf8"), /^import published/m);
});
