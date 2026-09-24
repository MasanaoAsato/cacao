import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { parseDirectionLimit } from "./src/theme/composition/directionLimit.ts";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	parseDirectionLimit(
		loadEnv(mode, process.cwd(), "VITE_BOOKLET_MAX_DIRECTIONS")
			.VITE_BOOKLET_MAX_DIRECTIONS,
	);
	return {
		plugins: [react()],
		server: {
			host: "0.0.0.0",
			allowedHosts: ["host.docker.internal"],
			proxy: {
				"/api": {
					target: "http://localhost:8080",
				},
			},
		},
	};
});
