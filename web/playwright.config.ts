import { defineConfig } from "@playwright/test";

export default defineConfig({
	forbidOnly: Boolean(process.env.CI),
	fullyParallel: true,
	reporter: process.env.CI ? "github" : "list",
	testDir: "./e2e",
	timeout: 30_000,
	workers: 1,
	expect: {
		timeout: 15_000,
	},
	use: {
		baseURL: "http://127.0.0.1:4173",
		viewport: { height: 1000, width: 1440 },
	},
	webServer: {
		command:
			"node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173",
		// Composition E2E covers fusion; override with 1 to verify the initial rollout.
		env: {
			VITE_BOOKLET_MAX_DIRECTIONS:
				process.env.VITE_BOOKLET_MAX_DIRECTIONS ?? "5",
		},
		port: 4173,
		reuseExistingServer: !process.env.CI,
	},
});
