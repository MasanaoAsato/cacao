import heroImage from "../../assets/hero.png";

export type PrintCssSpikeImage = {
	readonly alt: string;
	readonly height: number;
	readonly src: string;
	readonly width: number;
};

export type PrintCssSpikePageData = {
	readonly eyebrow: string;
	readonly id: string;
	readonly image?: PrintCssSpikeImage;
	readonly paragraphs: readonly string[];
	readonly title: string;
};

export type PrintCssSpikeFixture = {
	readonly label: string;
	readonly pages: readonly PrintCssSpikePageData[];
};

const sampleImage: PrintCssSpikeImage = {
	alt: "旅先の風景を表すサンプル画像",
	height: 361,
	src: heroImage,
	width: 343,
};

const coverPage: PrintCssSpikePageData = {
	eyebrow: "SPRING JOURNAL / 2026",
	id: "cover",
	image: sampleImage,
	paragraphs: [
		"海辺の朝から始まる、三日間の小さな旅。ページをめくるたび、街の音と余白がゆっくり重なります。",
	],
	title: "潮風の余白",
};

const dayOnePage: PrintCssSpikePageData = {
	eyebrow: "DAY 01 / 港と路地",
	id: "day-01",
	image: sampleImage,
	paragraphs: [
		"駅を出て、古い倉庫を改装した市場へ向かいます。朝の光が屋根の隙間から差し込み、焼きたてのパンの香りが路地まで流れます。",
		"昼下がりは小さな灯台まで歩き、「急がないこと」も旅の予定に加えます。句読点や括弧が行頭に来ない日本語組版を、この文章で確かめます。",
	],
	title: "光を集める港",
};

const dayTwoPage: PrintCssSpikePageData = {
	eyebrow: "DAY 02 / 森と工房",
	id: "day-02",
	paragraphs: [
		"二日目は森の入口にある工房を訪ねます。木の匂い、湯気の立つスープ、窓辺に置かれた道具が、静かな時間をつくります。",
		"夕方には丘の上から町を眺めます。長い文章が次のページへ逃げず、ひとつの固定ページの中に収まるかを確認します。",
	],
	title: "森の手触り",
};

const dayThreePage: PrintCssSpikePageData = {
	eyebrow: "DAY 03 / 帰路",
	id: "day-03",
	paragraphs: [
		"最終日は海沿いの書店で旅の記録を閉じます。見出し、本文、画像がそれぞれの位置を保ったまま、紙の上へ静かに移ることを目指します。",
		"帰りの列車を待つあいだ、次の季節にもう一度訪れる場所へ印を付けます。",
	],
	title: "余白を持ち帰る",
};

export const printCssSpikeFixtures = {
	short: {
		label: "短い旅（2ページ）",
		pages: [coverPage, dayOnePage],
	},
	long: {
		label: "長い旅（4ページ）",
		pages: [coverPage, dayOnePage, dayTwoPage, dayThreePage],
	},
} satisfies Record<string, PrintCssSpikeFixture>;

export type PrintCssSpikeFixtureId = keyof typeof printCssSpikeFixtures;
