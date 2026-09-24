/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { compiledProgram } from "../../../booklet/program/programTestKit";
import { testModel } from "../../../theme/composition/compositionTestKit";
import type { PlannedScene } from "./moduleRegistry";
import { useProgramReadiness } from "./useProgramReadiness";

const planned = {
	plan: { moduleId: "woodcut-folio", pages: [], sceneId: "x" },
	render: () => null,
	validateOutput: () => {},
} as unknown as PlannedScene;

describe("useProgramReadiness", () => {
	const model = testModel();
	const program = compiledProgram(["vintage-journal"], model);

	it("正常系: 全sceneの計画が揃うとchecking、最終確認でready", () => {
		const { result } = renderHook(() => useProgramReadiness(program, model, 2));
		expect(result.current.status).toBe("measuring");
		const runId = result.current.runId;
		act(() => result.current.reportPlanned(runId, "cover", planned));
		expect(result.current.status).toBe("measuring");
		act(() => result.current.reportPlanned(runId, "day:d1", planned));
		expect(result.current.status).toBe("checking");
		act(() => result.current.reportChecked(runId, 3));
		expect(result.current).toMatchObject({ pageCount: 3, status: "ready" });
	});

	it("異常系: 失敗はerrorに固定し、後から来た成功で上書きしない", () => {
		const { result } = renderHook(() => useProgramReadiness(program, model, 1));
		const runId = result.current.runId;
		act(() => result.current.reportFailed(runId, "失敗"));
		act(() => result.current.reportPlanned(runId, "cover", planned));
		expect(result.current).toMatchObject({ error: "失敗", status: "error" });
	});

	it("境界値系: model変更で新しい実行になり、古い実行の結果を捨てる", () => {
		const { rerender, result } = renderHook(
			({ current }) => useProgramReadiness(program, current, 1),
			{ initialProps: { current: model } },
		);
		const oldRun = result.current.runId;
		rerender({ current: testModel() });
		expect(result.current.runId).toBe(oldRun + 1);
		act(() => result.current.reportPlanned(oldRun, "cover", planned));
		act(() => result.current.reportFailed(oldRun, "古い失敗"));
		expect(result.current.status).toBe("measuring");
		expect(result.current.plans.size).toBe(0);
	});

	it("境界値系: アンマウント後の完了は反映しない", () => {
		const { result, unmount } = renderHook(() =>
			useProgramReadiness(program, model, 1),
		);
		const { reportPlanned, runId } = result.current;
		unmount();
		expect(() => reportPlanned(runId, "cover", planned)).not.toThrow();
	});

	it("正常系: programがなければidle", () => {
		const { result } = renderHook(() => useProgramReadiness(null, model, 0));
		expect(result.current.status).toBe("idle");
	});
});
