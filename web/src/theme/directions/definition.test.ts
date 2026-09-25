import { describe, expect, it } from "vitest";
import { defineDirection } from "./definition";

function make(revision?: number) {
	return defineDirection({
		id: "minimal",
		module: "woodcut-folio",
		revision,
		styleBundleId: "bright",
		touch: "none",
		signature: { label: "test", description: "test" },
	});
}

describe("defineDirection revision", () => {
	it("正常系: revisionに対応するreviewIdを作る", () => {
		expect(make().reviewId).toBe("direction:minimal:v1");
		expect(make(2)).toMatchObject({
			revision: 2,
			reviewId: "direction:minimal:v2",
		});
	});

	it("異常系: 0・小数・安全な整数超過を拒否する", () => {
		for (const revision of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
			expect(() => make(revision)).toThrow(/revision/);
	});

	it("境界値系: 最大の安全な整数を許可する", () => {
		expect(make(Number.MAX_SAFE_INTEGER).revision).toBe(
			Number.MAX_SAFE_INTEGER,
		);
	});
});
