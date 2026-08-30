import "@fontsource/m-plus-rounded-1c/400.css";
import "@fontsource/m-plus-rounded-1c/700.css";
import "@fontsource/noto-sans-jp/400.css";
import "@fontsource/noto-sans-jp/700.css";
import "@fontsource/noto-serif-jp/400.css";
import "@fontsource/noto-serif-jp/700.css";
import "@fontsource/shippori-mincho/400.css";
import "@fontsource/shippori-mincho/700.css";
import "@fontsource/zen-kaku-gothic-new/400.css";
import "@fontsource/zen-kaku-gothic-new/700.css";
import "./print.css";
import "./theme/bookletTheme.css";
import { Route, Routes } from "react-router";
import { JourneyBookletPage } from "./pages/journey-booklet/JourneyBookletPage";
import { JourneyCreationPage } from "./pages/journey-creation/JourneyCreationPage";
import { PrintCssSpikePage } from "./pages/print-css-spike/PrintCssSpikePage";

function NotFoundPage() {
	return <p>ページが見つかりません。</p>;
}

function App() {
	return (
		<Routes>
			<Route path="/" element={<JourneyCreationPage />} />
			<Route
				path="/journeys/:journeyId/booklet"
				element={<JourneyBookletPage />}
			/>
			<Route path="/print-css-spike" element={<PrintCssSpikePage />} />
			<Route path="*" element={<NotFoundPage />} />
		</Routes>
	);
}

export default App;
