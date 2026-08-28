import { useEffect, useRef, useState } from "react";
import {
	type PrintCssSpikeFixtureId,
	type PrintCssSpikePageData,
	printCssSpikeFixtures,
} from "./printCssSpikeFixture";

type Readiness =
	| { readonly status: "loading" }
	| { readonly error: string; readonly status: "error" }
	| { readonly status: "ready" };

const initialFixtureId: PrintCssSpikeFixtureId = "long";

function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}

async function waitForImageDecode(image: HTMLImageElement): Promise<void> {
	if (typeof image.decode === "function") {
		try {
			await image.decode();
			return;
		} catch {
			throw new Error(`画像「${image.alt}」の読み込みに失敗しました。`);
		}
	}

	if (image.complete && image.naturalWidth > 0) {
		return;
	}

	await new Promise<void>((resolve, reject) => {
		const handleLoad = () => {
			cleanup();
			resolve();
		};
		const handleError = () => {
			cleanup();
			reject(new Error(`画像「${image.alt}」の読み込みに失敗しました。`));
		};
		const cleanup = () => {
			image.removeEventListener("load", handleLoad);
			image.removeEventListener("error", handleError);
		};

		image.addEventListener("load", handleLoad, { once: true });
		image.addEventListener("error", handleError, { once: true });
	});
}

async function waitForFonts(): Promise<void> {
	if (!document.fonts) {
		return;
	}

	await document.fonts.ready;
	const regularLoaded = document.fonts.check('400 16px "Noto Serif JP"');
	const boldLoaded = document.fonts.check('700 16px "Noto Serif JP"');
	if (!regularLoaded || !boldLoaded) {
		throw new Error("Noto Serif JP の読み込みを確認できませんでした。");
	}
}

function ensurePagesFit(pages: readonly HTMLElement[]): void {
	const overflowingPageIndex = pages.findIndex(
		(page) =>
			page.scrollHeight > page.clientHeight ||
			page.scrollWidth > page.clientWidth,
	);
	if (overflowingPageIndex !== -1) {
		throw new Error(
			`${overflowingPageIndex + 1} ページ目の内容が A5 ページに収まりません。`,
		);
	}
}

function PrintPage({
	page,
	pageIndex,
	setImageRef,
	setPageRef,
}: {
	readonly page: PrintCssSpikePageData;
	readonly pageIndex: number;
	readonly setImageRef: (
		pageIndex: number,
		image: HTMLImageElement | null,
	) => void;
	readonly setPageRef: (pageIndex: number, page: HTMLElement | null) => void;
}) {
	return (
		<article
			ref={(pageElement) => setPageRef(pageIndex, pageElement)}
			className="print-page"
			data-page-id={page.id}
		>
			<p className="print-page__eyebrow">{page.eyebrow}</p>
			<h2 className="print-page__title">{page.title}</h2>
			{page.image ? (
				<img
					ref={(image) => setImageRef(pageIndex, image)}
					className="print-page__image"
					height={page.image.height}
					src={page.image.src}
					alt={page.image.alt}
					width={page.image.width}
				/>
			) : null}
			<div className="print-page__body">
				{page.paragraphs.map((paragraph) => (
					<p key={paragraph}>{paragraph}</p>
				))}
			</div>
			<p className="print-page__number">
				{String(pageIndex + 1).padStart(2, "0")}
			</p>
		</article>
	);
}

export function PrintCssSpikePage() {
	const [fixtureId, setFixtureId] =
		useState<PrintCssSpikeFixtureId>(initialFixtureId);
	const [readiness, setReadiness] = useState<Readiness>({ status: "loading" });
	const imageRefs = useRef<Array<HTMLImageElement | null>>([]);
	const pageRefs = useRef<Array<HTMLElement | null>>([]);
	const fixture = printCssSpikeFixtures[fixtureId];

	useEffect(() => {
		let cancelled = false;
		setReadiness({ status: "loading" });

		const runReadinessCheck = async () => {
			try {
				const images = fixture.pages
					.map((page, pageIndex) =>
						page.image ? imageRefs.current[pageIndex] : null,
					)
					.filter((image): image is HTMLImageElement => image !== null);
				const pages = fixture.pages
					.map((_, pageIndex) => pageRefs.current[pageIndex])
					.filter((page): page is HTMLElement => page !== null);
				if (pages.length !== fixture.pages.length) {
					throw new Error("印刷ページを準備できませんでした。");
				}
				await Promise.all(images.map(waitForImageDecode));
				await waitForFonts();
				ensurePagesFit(pages);
				if (!cancelled) {
					setReadiness({ status: "ready" });
				}
			} catch (error) {
				if (!cancelled) {
					setReadiness({
						error: errorMessage(error, "印刷前の準備に失敗しました。"),
						status: "error",
					});
				}
			}
		};

		void runReadinessCheck();
		return () => {
			cancelled = true;
		};
	}, [fixture]);

	const handleFixtureChange = (value: string) => {
		if (value in printCssSpikeFixtures) {
			setReadiness({ status: "loading" });
			setFixtureId(value as PrintCssSpikeFixtureId);
		}
	};

	const setImageRef = (pageIndex: number, image: HTMLImageElement | null) => {
		imageRefs.current[pageIndex] = image;
	};
	const setPageRef = (pageIndex: number, page: HTMLElement | null) => {
		pageRefs.current[pageIndex] = page;
	};

	return (
		<div className="print-spike-shell">
			<section className="print-controls" aria-label="印刷スパイク操作">
				<div className="print-controls__field">
					<label htmlFor="fixture-select">検証するページ数</label>
					<select
						id="fixture-select"
						value={fixtureId}
						onChange={(event) => handleFixtureChange(event.target.value)}
					>
						{Object.entries(printCssSpikeFixtures).map(([id, option]) => (
							<option key={id} value={id}>
								{option.label}
							</option>
						))}
					</select>
				</div>
				<button
					type="button"
					disabled={readiness.status !== "ready"}
					onClick={() => window.print()}
				>
					PDF を印刷
				</button>
				<p className="print-controls__status" role="status" aria-live="polite">
					{readiness.status === "loading"
						? "画像とフォントを準備しています…"
						: null}
					{readiness.status === "ready" ? "印刷の準備ができました。" : null}
					{readiness.status === "error" ? readiness.error : null}
				</p>
			</section>

			<main className="print-document" aria-label="旅のしおり印刷プレビュー">
				{fixture.pages.map((page, pageIndex) => (
					<PrintPage
						key={page.id}
						page={page}
						pageIndex={pageIndex}
						setImageRef={setImageRef}
						setPageRef={setPageRef}
					/>
				))}
			</main>
		</div>
	);
}
