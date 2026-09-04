import { type ApiRequestOptions, requestBlob } from "./client";

export type DownloadJourneyBookletPdfOptions = ApiRequestOptions & {
	readonly seed?: string;
};

export function downloadJourneyBookletPdf(
	journeyId: string,
	options: DownloadJourneyBookletPdfOptions = {},
): Promise<Blob> {
	const { seed, ...requestOptions } = options;
	const params = new URLSearchParams();
	if (seed !== undefined) {
		params.set("seed", seed);
	}
	const query = params.toString();
	const suffix = query === "" ? "" : `?${query}`;
	const path = `/api/v1/journeys/${encodeURIComponent(journeyId)}/booklet.pdf${suffix}`;

	return requestBlob(path, {
		...requestOptions,
		expectedContentType: "application/pdf",
	});
}
