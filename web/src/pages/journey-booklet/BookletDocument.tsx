import type { RefObject } from "react";
import type {
	ArrivalUnit,
	BookletCover,
	BookletDay,
	BookletModel,
	BookletPagePlan,
} from "../../booklet/model";

export type BookletDocumentProps = {
	readonly model: BookletModel;
	readonly pagePlan: readonly BookletPagePlan[];
	readonly rootRef: RefObject<HTMLElement | null>;
};

export type BookletMeasurementProps = {
	readonly model: BookletModel;
	readonly rootRef: RefObject<HTMLDivElement | null>;
};

function formatMoney(money: {
	readonly amount: number;
	readonly currency: string;
}): string {
	return `${money.amount.toLocaleString("ja-JP")} ${money.currency}`;
}

function displayDateTime(value: string): string {
	return value.replace("T", " ");
}

function CoverContent({ cover }: { readonly cover: BookletCover }) {
	return (
		<div className="booklet-cover-content">
			<p className="booklet-eyebrow">TRAVEL JOURNAL</p>
			<h1 className="booklet-cover__title">{cover.destination}</h1>
			<p className="booklet-cover__route">
				{cover.departure} <span aria-hidden="true">→</span> {cover.destination}
			</p>
			<p className="booklet-cover__period">
				<time dateTime={cover.period.start_date}>
					{displayDateTime(cover.period.start_date)}
				</time>
				<span aria-hidden="true"> — </span>
				<time dateTime={cover.period.end_date}>
					{displayDateTime(cover.period.end_date)}
				</time>
			</p>
			<div className="booklet-cover__image-frame">
				<img
					className="booklet-cover__image"
					decoding="async"
					height={cover.image.height}
					loading="eager"
					src={cover.image.contentUrl}
					alt={`${cover.destination}の表紙画像`}
					width={cover.image.width}
				/>
			</div>
			<p className="booklet-cover__budget">予算 {formatMoney(cover.budget)}</p>
		</div>
	);
}

function DayHeader({
	continuation,
	day,
}: {
	readonly continuation: boolean;
	readonly day: BookletDay;
}) {
	return (
		<header
			className={`booklet-day-header${continuation ? " booklet-day-header--continuation" : ""}`}
		>
			<p className="booklet-eyebrow">
				DAY {String(day.dayNumber).padStart(2, "0")}
				{continuation ? "（続き）" : ""}
			</p>
			<h2>{displayDateTime(day.date)}</h2>
		</header>
	);
}

function ArrivalUnitView({
	measurementKey,
	unit,
}: {
	readonly measurementKey?: string;
	readonly unit: ArrivalUnit;
}) {
	return (
		<section
			className="booklet-unit"
			data-booklet-measurement-unit={measurementKey}
			data-unit-id={unit.id}
		>
			<div className="booklet-unit__leg">
				<p className="booklet-unit__label">移動</p>
				<p className="booklet-unit__route">
					<span>{unit.leg.from.label}</span>
					<span aria-hidden="true"> → </span>
					<span>{unit.leg.to.label}</span>
				</p>
				<dl className="booklet-unit__details">
					<div>
						<dt>交通</dt>
						<dd>{unit.leg.mode}</dd>
					</div>
					<div>
						<dt>所要時間</dt>
						<dd>{unit.leg.duration_minutes}分</dd>
					</div>
					<div>
						<dt>移動費</dt>
						<dd>{formatMoney(unit.leg.estimated_cost)}</dd>
					</div>
				</dl>
			</div>
			<div className="booklet-unit__spot">
				<p className="booklet-unit__label">SPOT</p>
				<p className="booklet-unit__time">
					<time dateTime={unit.spot.start_at}>
						{displayDateTime(unit.spot.start_at)}
					</time>
				</p>
				<h3>{unit.spot.name}</h3>
				<p>{unit.spot.description}</p>
				<p className="booklet-unit__cost">
					滞在費 {formatMoney(unit.spot.estimated_cost)}
				</p>
			</div>
		</section>
	);
}

function DayPage({
	day,
	page,
}: {
	readonly day: BookletDay;
	readonly page: Extract<BookletPagePlan, { readonly kind: "day" }>;
}) {
	return (
		<>
			<DayHeader continuation={page.continuation} day={day} />
			<div className="booklet-day__units">
				{page.unitIndexes.map((unitIndex) => {
					const unit = day.units[unitIndex];
					return unit ? <ArrivalUnitView key={unit.id} unit={unit} /> : null;
				})}
			</div>
		</>
	);
}

function PhysicalPage({
	model,
	page,
}: {
	readonly model: BookletModel;
	readonly page: BookletPagePlan;
}) {
	const pageContent =
		page.kind === "cover" ? (
			<CoverContent cover={model.cover} />
		) : model.days[page.dayIndex] ? (
			<DayPage day={model.days[page.dayIndex]} page={page} />
		) : null;

	return (
		<article
			className={`booklet-page booklet-page--${page.kind}`}
			data-booklet-page="true"
			data-page-id={page.pageId}
		>
			<div className="booklet-page__content">{pageContent}</div>
		</article>
	);
}

export function BookletDocument({
	model,
	pagePlan,
	rootRef,
}: BookletDocumentProps) {
	return (
		<main
			ref={rootRef}
			className="booklet-document"
			aria-label="旅のしおり印刷プレビュー"
		>
			{pagePlan.map((page) => (
				<PhysicalPage key={page.pageId} model={model} page={page} />
			))}
		</main>
	);
}

function MeasurementDay({
	day,
	dayIndex,
}: {
	readonly day: BookletDay;
	readonly dayIndex: number;
}) {
	return (
		<article className="booklet-page booklet-page--measurement">
			<div
				className="booklet-page__content"
				data-booklet-measurement-content="true"
			>
				<div className="booklet-measurement__sample">
					<DayHeader continuation={false} day={day} />
					<DayHeader continuation day={day} />
				</div>
				<div className="booklet-day__units">
					{day.units.map((unit, unitIndex) => (
						<ArrivalUnitView
							key={unit.id}
							measurementKey={`${dayIndex}-${unitIndex}`}
							unit={unit}
						/>
					))}
				</div>
			</div>
		</article>
	);
}

export function BookletMeasurement({
	model,
	rootRef,
}: BookletMeasurementProps) {
	return (
		<div ref={rootRef} className="booklet-measurement" aria-hidden="true">
			<article className="booklet-page booklet-page--cover">
				<div
					className="booklet-page__content"
					data-booklet-measurement-content="true"
				>
					<div data-booklet-measurement-cover-body="true">
						<CoverContent cover={model.cover} />
					</div>
				</div>
			</article>
			{model.days.map((day, dayIndex) => (
				<MeasurementDay key={day.id} day={day} dayIndex={dayIndex} />
			))}
		</div>
	);
}
