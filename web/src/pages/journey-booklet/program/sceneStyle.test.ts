import { describe, expect, it } from "vitest";
import { compiledProgram } from "../../../booklet/program/programTestKit";
import {
	scriptedRandom,
	testModel,
} from "../../../theme/composition/compositionTestKit";
import { resolveSceneStyle } from "./sceneStyle";

describe("resolveSceneStyle", () => {
	it("正常系: 紙・本文・装飾色を一つの束として変数にし、使う書体とweightだけを返す", () => {
		const scene = compiledProgram(["rail"]).scenes[0];
		if (!scene) throw new Error("scene");
		const style = resolveSceneStyle(scene);
		expect(style.vars).toMatchObject({
			"--scene-accent": style.surface.accentColor,
			"--scene-ink": style.surface.bodyColor,
			"--scene-paper": style.surface.paperColor,
		});
		expect(style.fonts).toEqual([
			{ family: "Zen Kaku Gothic New", weight: 700 },
			{ family: "Noto Sans JP", weight: 400 },
		]);
		expect(style.styleId).toBe("bright");
	});

	it("正常系: 登録地のご当地配色は紙・本文・装飾をまとめて置き換える", () => {
		const model = testModel({
			destinationPlace: { city: "京都", country: "日本" },
		});
		const scene = compiledProgram(["local-color"], model).scenes[0];
		if (!scene) throw new Error("scene");
		const style = resolveSceneStyle(scene);
		expect(style.surface).toMatchObject({
			accentColor: "#A33E32",
			bodyColor: "#20352D",
			paperColor: "#F6F2E8",
		});
		expect(style.styleId).toBe("bright/locale:kyoto");
	});

	it("境界値系: 移植された見出し束は自分の紙色の帯として描き、束のfontも待つ", () => {
		const program = compiledProgram(
			["rail", "cafe"],
			undefined,
			scriptedRandom({
				choices: { direction: 0, operation: 0.5, scope: 0 },
				steps: 1,
			}),
		);
		const scene = program.scenes.find(
			(item) =>
				item.config.heading.styleBundleId !== item.config.surface.styleBundleId,
		);
		if (!scene) return;
		const style = resolveSceneStyle(scene);
		expect(style.vars).toMatchObject({
			"--scene-heading-paper": style.heading.paperColor,
		});
		expect(style.styleId).toContain("heading:");
		expect(style.fonts.length).toBeGreaterThan(2);
	});
});
