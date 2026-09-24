import { describe, expect, it } from "vitest";
import { testModel } from "../../theme/composition/compositionTestKit";
import {
	failedWorkState,
	isPrintableWork,
	pendingWorkState,
	readyWorkState,
} from "./workState";

describe("isPrintableWork", () => {
	const model = testModel();
	const ready = readyWorkState({
		generation: 3,
		model,
		pageCount: 4,
		renderKey: "k",
	});

	it("正常系: 現在のmodel参照・renderKey・世代に一致するreadyだけ印刷できる", () => {
		expect(
			isPrintableWork(ready, { generation: 3, model, renderKey: "k" }),
		).toBe(true);
	});

	it("異常系: 別のmodel参照・renderKey・古い世代・ready以外は印刷しない", () => {
		expect(
			isPrintableWork(ready, {
				generation: 3,
				model: testModel(),
				renderKey: "k",
			}),
		).toBe(false);
		expect(
			isPrintableWork(ready, { generation: 3, model, renderKey: "x" }),
		).toBe(false);
		expect(
			isPrintableWork(ready, { generation: 4, model, renderKey: "k" }),
		).toBe(false);
		expect(
			isPrintableWork(pendingWorkState("checking", 3), {
				generation: 3,
				model,
				renderKey: "k",
			}),
		).toBe(false);
		expect(
			isPrintableWork(failedWorkState("x", 3), {
				generation: 3,
				model,
				renderKey: "k",
			}),
		).toBe(false);
	});

	it("境界値系: ページ数0のreadyは印刷しない。ready以外はprepared値を持たない", () => {
		expect(
			isPrintableWork(
				readyWorkState({ generation: 1, model, pageCount: 0, renderKey: "k" }),
				{ generation: 1, model, renderKey: "k" },
			),
		).toBe(false);
		expect(failedWorkState("x", 1)).toMatchObject({
			pageCount: null,
			preparedModel: null,
			preparedRenderKey: null,
		});
	});
});
