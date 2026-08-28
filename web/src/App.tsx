import "./print.css";
import { Route, Routes } from "react-router";
import { JourneyBookletPage } from "./pages/journey-booklet/JourneyBookletPage";
import { PrintCssSpikePage } from "./pages/print-css-spike/PrintCssSpikePage";

function NotFoundPage() {
	return <p>ページが見つかりません。</p>;
}

function App() {
	return (
		<Routes>
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
