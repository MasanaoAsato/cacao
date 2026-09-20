package imageprompt

import (
	"fmt"

	"cacao/src/domain/value_object"
)

var coverStyleInstructions = map[value_object.ImageVisualStyle]string{
	value_object.ImageVisualStyleTransparentWatercolor:      "Render as a transparent watercolor illustration with pale colors, soft light, airy washes, and a calm refreshing mood.",
	value_object.ImageVisualStyleRefinedTravelEditorial:     "Render with the polished composition and restrained palette of a premium travel magazine, elegant and sophisticated, but without typography.",
	value_object.ImageVisualStyleLuminousAnimeBackground:    "Render as finely detailed Japanese animation background art with vivid natural light, fresh atmosphere, and emotional anticipation of a journey.",
	value_object.ImageVisualStyleRetroTravelPoster:          "Render with bold composition, slightly faded colors, and warm nostalgia inspired by a retro travel poster, without typography or logos.",
	value_object.ImageVisualStyleCinematicStory:             "Render with dramatic cinematic lighting, layered depth, and a story-beginning sense of travel.",
	value_object.ImageVisualStyleMinimalFlatLandmarks:       "Render as a modern minimal flat illustration with clear shapes and a sparse arrangement of place-specific scenery and motifs.",
	value_object.ImageVisualStyleSoftPastelHoliday:          "Render with pastel colors, rounded forms, and a light playful touch evoking a cheerful holiday.",
	value_object.ImageVisualStyleWatercolorPencilSketch:     "Render as a warm travel sketchbook drawing combining colored pencil lines and watercolor washes.",
	value_object.ImageVisualStyleVintagePostcard:            "Render with muted colors, subtle grain, and nostalgic old-postcard character, without borders, stamps, or writing.",
	value_object.ImageVisualStyleQuietPhotoBook:             "Render like a quiet fine-art photo book cover, using natural light, restrained scenery, and intentional negative space without typography.",
	value_object.ImageVisualStyleSunnyVacation:              "Render with vivid blue sky and bright sunlight, creating an open and uplifting classic vacation atmosphere.",
	value_object.ImageVisualStyleGoldenHourSentimental:      "Render with soft dawn or sunset backlight, expressing a sentimental and beautiful moment away from home.",
	value_object.ImageVisualStyleArchitecturalPenSketch:     "Render as a classical travel sketch with detailed pen drawing and restrained color focused on local architecture and streetscapes.",
	value_object.ImageVisualStyleTravelIconCollage:          "Render as a lively collage of small illustrations of local food, buildings, nature, and transportation, without words.",
	value_object.ImageVisualStylePaperCutStorybook:          "Render as a friendly storybook scene made from layered paper cutouts and papercraft-like depth.",
	value_object.ImageVisualStyleJapaneseRetroTravelAd:      "Render with bright color and refreshing composition inspired by 1980s and 1990s Japanese travel advertising, without text or logos.",
	value_object.ImageVisualStyleNordicEarthMinimal:         "Render with simple forms and gentle earth colors inspired by Nordic design, expressing a quiet and comfortable journey.",
	value_object.ImageVisualStyleLiteraryInkWash:            "Render as a literary travel painting in ink and light color, conveying local history and culture.",
	value_object.ImageVisualStyleEmotionalFilmPhoto:         "Render like an emotional film photograph with soft light, delicate grain, and naturally faded color.",
	value_object.ImageVisualStyleLuxuryTravelAd:             "Render with the poised composition and premium lighting of a luxury hotel or airline advertisement, without branding or text.",
	value_object.ImageVisualStylePopGeometricTravel:         "Render as a bright playful graphic using pop color, bold geometry, and stylized place-specific travel motifs.",
	value_object.ImageVisualStyleSeasonalNature:             "Render local plants, weather, and seasonal air carefully enough to feel like walking through the destination.",
	value_object.ImageVisualStyleAntiqueTravelJournal:       "Render an antique travel journal in cream and beige with unlettered old-map contours and ticket-like shapes.",
	value_object.ImageVisualStyleEpicWideAdventure:          "Render a sweeping wide-angle landscape with a small person, evoking cinematic adventure into unknown land.",
	value_object.ImageVisualStyleQuietNeighborhood:          "Render an ordinary local street corner, cafe, or alley in soft light, with quiet travel feeling rather than overt tourism.",
	value_object.ImageVisualStyleBlueWhiteUrban:             "Render with a clean blue-and-white palette and sharp composition for a refreshing urban travel design.",
	value_object.ImageVisualStyleTranquilOutdoors:           "Render with deep green and brown natural colors, expressing the calm of forests, mountains, and lakes.",
	value_object.ImageVisualStyleRomanticNightNeon:          "Render night scenery, streetlights, and neon glow as a romantic, slightly fantastical travel night, with blank sign surfaces.",
	value_object.ImageVisualStyleNotebookLineArt:            "Render with gentle line art and light color while preserving ample white, like an intimate notebook illustration.",
	value_object.ImageVisualStyleElegantSemiReal:            "Render an elegant semi-real illustration that faithfully includes local architecture, vegetation, climate, and culture while subtly idealizing reality.",
	value_object.ImageVisualStyleFantasyStorybook:           "Render a fantastical storybook scene with warm light and delicate detail, making the journey feel like a small story.",
	value_object.ImageVisualStyleLuminousYouthAnime:         "Render like a contemporary Japanese light-novel or youth-film background with clear air, strong light, and fresh bittersweet emotion.",
	value_object.ImageVisualStyleMiniatureDiorama:           "Render a charming miniature diorama viewed from above, arranging local buildings, roads, and nature playfully.",
	value_object.ImageVisualStyleIdealizedPhotoIllustration: "Render with a crisp texture between photograph and illustration, retaining realism while subtly idealizing the destination.",
	value_object.ImageVisualStyleJapaneseQuietMinimal:       "Render a restrained Japanese composition with low saturation, generous visual breathing room, quietness, and afterglow.",
	value_object.ImageVisualStyleDynamicVividPoster:         "Render with strong contrast, vivid color, and bold composition that foreground travel excitement and energy, without text or logos.",
	value_object.ImageVisualStyleHealingBacklightNature:     "Render soft backlight, dappled sun, and wind-touched plants in detail, conveying restorative air and comfort.",
	value_object.ImageVisualStyleClassicAdventureNovel:      "Render like an old adventure novel illustration combining landscape painting with an unlettered map and compass without direction letters.",
	value_object.ImageVisualStyleLimitedColorLineArt:        "Render local character with simple lines and only a limited number of colors, in a stylish design suited to print.",
	value_object.ImageVisualStyleNaturalTravelPhoto:         "Render as a natural travel photograph with gentle color correction, prioritizing authentic local atmosphere over decoration.",
}

func coverStyleInstruction(style value_object.ImageVisualStyle) (string, error) {
	instruction, ok := coverStyleInstructions[style]
	if !ok {
		return "", fmt.Errorf("unsupported cover image visual style: %q", style)
	}

	return instruction, nil
}
