package value_object

import (
	"fmt"
	"slices"
)

// ImageVisualStyle は画像生成で使用するプロバイダー中立の画風IDを表す。
type ImageVisualStyle string

const (
	ImageVisualStyleNone                ImageVisualStyle = "none"
	ImageVisualStyleEditorialPhotograph ImageVisualStyle = "editorial-photograph"
	ImageVisualStyleCinematicPhotograph ImageVisualStyle = "cinematic-photograph"
	ImageVisualStyleWatercolor          ImageVisualStyle = "watercolor"
	ImageVisualStyleGouache             ImageVisualStyle = "gouache"
	ImageVisualStyleOilPainting         ImageVisualStyle = "oil-painting"
	ImageVisualStylePastel              ImageVisualStyle = "pastel"

	ImageVisualStyleTransparentWatercolor      ImageVisualStyle = "transparent-watercolor"
	ImageVisualStyleRefinedTravelEditorial     ImageVisualStyle = "refined-travel-editorial"
	ImageVisualStyleLuminousAnimeBackground    ImageVisualStyle = "luminous-anime-background"
	ImageVisualStyleRetroTravelPoster          ImageVisualStyle = "retro-travel-poster"
	ImageVisualStyleCinematicStory             ImageVisualStyle = "cinematic-story"
	ImageVisualStyleMinimalFlatLandmarks       ImageVisualStyle = "minimal-flat-landmarks"
	ImageVisualStyleSoftPastelHoliday          ImageVisualStyle = "soft-pastel-holiday"
	ImageVisualStyleWatercolorPencilSketch     ImageVisualStyle = "watercolor-pencil-sketch"
	ImageVisualStyleVintagePostcard            ImageVisualStyle = "vintage-postcard"
	ImageVisualStyleQuietPhotoBook             ImageVisualStyle = "quiet-photo-book"
	ImageVisualStyleSunnyVacation              ImageVisualStyle = "sunny-vacation"
	ImageVisualStyleGoldenHourSentimental      ImageVisualStyle = "golden-hour-sentimental"
	ImageVisualStyleArchitecturalPenSketch     ImageVisualStyle = "architectural-pen-sketch"
	ImageVisualStyleTravelIconCollage          ImageVisualStyle = "travel-icon-collage"
	ImageVisualStylePaperCutStorybook          ImageVisualStyle = "paper-cut-storybook"
	ImageVisualStyleJapaneseRetroTravelAd      ImageVisualStyle = "japanese-retro-travel-ad"
	ImageVisualStyleNordicEarthMinimal         ImageVisualStyle = "nordic-earth-minimal"
	ImageVisualStyleLiteraryInkWash            ImageVisualStyle = "literary-ink-wash"
	ImageVisualStyleEmotionalFilmPhoto         ImageVisualStyle = "emotional-film-photo"
	ImageVisualStyleLuxuryTravelAd             ImageVisualStyle = "luxury-travel-ad"
	ImageVisualStylePopGeometricTravel         ImageVisualStyle = "pop-geometric-travel"
	ImageVisualStyleSeasonalNature             ImageVisualStyle = "seasonal-nature"
	ImageVisualStyleAntiqueTravelJournal       ImageVisualStyle = "antique-travel-journal"
	ImageVisualStyleEpicWideAdventure          ImageVisualStyle = "epic-wide-adventure"
	ImageVisualStyleQuietNeighborhood          ImageVisualStyle = "quiet-neighborhood"
	ImageVisualStyleBlueWhiteUrban             ImageVisualStyle = "blue-white-urban"
	ImageVisualStyleTranquilOutdoors           ImageVisualStyle = "tranquil-outdoors"
	ImageVisualStyleRomanticNightNeon          ImageVisualStyle = "romantic-night-neon"
	ImageVisualStyleNotebookLineArt            ImageVisualStyle = "notebook-line-art"
	ImageVisualStyleElegantSemiReal            ImageVisualStyle = "elegant-semireal"
	ImageVisualStyleFantasyStorybook           ImageVisualStyle = "fantasy-storybook"
	ImageVisualStyleLuminousYouthAnime         ImageVisualStyle = "luminous-youth-anime"
	ImageVisualStyleMiniatureDiorama           ImageVisualStyle = "miniature-diorama"
	ImageVisualStyleIdealizedPhotoIllustration ImageVisualStyle = "idealized-photo-illustration"
	ImageVisualStyleJapaneseQuietMinimal       ImageVisualStyle = "japanese-quiet-minimal"
	ImageVisualStyleDynamicVividPoster         ImageVisualStyle = "dynamic-vivid-poster"
	ImageVisualStyleHealingBacklightNature     ImageVisualStyle = "healing-backlight-nature"
	ImageVisualStyleClassicAdventureNovel      ImageVisualStyle = "classic-adventure-novel"
	ImageVisualStyleLimitedColorLineArt        ImageVisualStyle = "limited-color-line-art"
	ImageVisualStyleNaturalTravelPhoto         ImageVisualStyle = "natural-travel-photo"
)

var validImageVisualStyles = map[ImageVisualStyle]struct{}{
	ImageVisualStyleNone:                       {},
	ImageVisualStyleEditorialPhotograph:        {},
	ImageVisualStyleCinematicPhotograph:        {},
	ImageVisualStyleWatercolor:                 {},
	ImageVisualStyleGouache:                    {},
	ImageVisualStyleOilPainting:                {},
	ImageVisualStylePastel:                     {},
	ImageVisualStyleTransparentWatercolor:      {},
	ImageVisualStyleRefinedTravelEditorial:     {},
	ImageVisualStyleLuminousAnimeBackground:    {},
	ImageVisualStyleRetroTravelPoster:          {},
	ImageVisualStyleCinematicStory:             {},
	ImageVisualStyleMinimalFlatLandmarks:       {},
	ImageVisualStyleSoftPastelHoliday:          {},
	ImageVisualStyleWatercolorPencilSketch:     {},
	ImageVisualStyleVintagePostcard:            {},
	ImageVisualStyleQuietPhotoBook:             {},
	ImageVisualStyleSunnyVacation:              {},
	ImageVisualStyleGoldenHourSentimental:      {},
	ImageVisualStyleArchitecturalPenSketch:     {},
	ImageVisualStyleTravelIconCollage:          {},
	ImageVisualStylePaperCutStorybook:          {},
	ImageVisualStyleJapaneseRetroTravelAd:      {},
	ImageVisualStyleNordicEarthMinimal:         {},
	ImageVisualStyleLiteraryInkWash:            {},
	ImageVisualStyleEmotionalFilmPhoto:         {},
	ImageVisualStyleLuxuryTravelAd:             {},
	ImageVisualStylePopGeometricTravel:         {},
	ImageVisualStyleSeasonalNature:             {},
	ImageVisualStyleAntiqueTravelJournal:       {},
	ImageVisualStyleEpicWideAdventure:          {},
	ImageVisualStyleQuietNeighborhood:          {},
	ImageVisualStyleBlueWhiteUrban:             {},
	ImageVisualStyleTranquilOutdoors:           {},
	ImageVisualStyleRomanticNightNeon:          {},
	ImageVisualStyleNotebookLineArt:            {},
	ImageVisualStyleElegantSemiReal:            {},
	ImageVisualStyleFantasyStorybook:           {},
	ImageVisualStyleLuminousYouthAnime:         {},
	ImageVisualStyleMiniatureDiorama:           {},
	ImageVisualStyleIdealizedPhotoIllustration: {},
	ImageVisualStyleJapaneseQuietMinimal:       {},
	ImageVisualStyleDynamicVividPoster:         {},
	ImageVisualStyleHealingBacklightNature:     {},
	ImageVisualStyleClassicAdventureNovel:      {},
	ImageVisualStyleLimitedColorLineArt:        {},
	ImageVisualStyleNaturalTravelPhoto:         {},
}

var coverImageVisualStyleCatalog = []ImageVisualStyle{
	ImageVisualStyleTransparentWatercolor,
	ImageVisualStyleRefinedTravelEditorial,
	ImageVisualStyleLuminousAnimeBackground,
	ImageVisualStyleRetroTravelPoster,
	ImageVisualStyleCinematicStory,
	ImageVisualStyleMinimalFlatLandmarks,
	ImageVisualStyleSoftPastelHoliday,
	ImageVisualStyleWatercolorPencilSketch,
	ImageVisualStyleVintagePostcard,
	ImageVisualStyleQuietPhotoBook,
	ImageVisualStyleSunnyVacation,
	ImageVisualStyleGoldenHourSentimental,
	ImageVisualStyleArchitecturalPenSketch,
	ImageVisualStyleTravelIconCollage,
	ImageVisualStylePaperCutStorybook,
	ImageVisualStyleJapaneseRetroTravelAd,
	ImageVisualStyleNordicEarthMinimal,
	ImageVisualStyleLiteraryInkWash,
	ImageVisualStyleEmotionalFilmPhoto,
	ImageVisualStyleLuxuryTravelAd,
	ImageVisualStylePopGeometricTravel,
	ImageVisualStyleSeasonalNature,
	ImageVisualStyleAntiqueTravelJournal,
	ImageVisualStyleEpicWideAdventure,
	ImageVisualStyleQuietNeighborhood,
	ImageVisualStyleBlueWhiteUrban,
	ImageVisualStyleTranquilOutdoors,
	ImageVisualStyleRomanticNightNeon,
	ImageVisualStyleNotebookLineArt,
	ImageVisualStyleElegantSemiReal,
	ImageVisualStyleFantasyStorybook,
	ImageVisualStyleLuminousYouthAnime,
	ImageVisualStyleMiniatureDiorama,
	ImageVisualStyleIdealizedPhotoIllustration,
	ImageVisualStyleJapaneseQuietMinimal,
	ImageVisualStyleDynamicVividPoster,
	ImageVisualStyleHealingBacklightNature,
	ImageVisualStyleClassicAdventureNovel,
	ImageVisualStyleLimitedColorLineArt,
	ImageVisualStyleNaturalTravelPhoto,
}

// CoverImageVisualStyleCatalog は表紙用画風カタログのコピーを返す。
// 要素の順序は画像IDからの決定的選択に使用するため変更してはならない。
func CoverImageVisualStyleCatalog() []ImageVisualStyle {
	return slices.Clone(coverImageVisualStyleCatalog)
}

// NewImageVisualStyle は許可された画風IDを作成する。
func NewImageVisualStyle(s string) (ImageVisualStyle, error) {
	style := ImageVisualStyle(s)
	if _, ok := validImageVisualStyles[style]; !ok {
		return "", fmt.Errorf("invalid image visual style: %q", s)
	}

	return style, nil
}

// String は画風IDの文字列表現を返す。
func (s ImageVisualStyle) String() string {
	return string(s)
}

// Validate は画風IDが許可されているか検証する。
func (s ImageVisualStyle) Validate() error {
	_, err := NewImageVisualStyle(s.String())
	return err
}

// ValidateFor は画像用途と画風IDの組み合わせを検証する。
func (s ImageVisualStyle) ValidateFor(purpose ImagePurpose) error {
	if err := purpose.Validate(); err != nil {
		return fmt.Errorf("image purpose: %w", err)
	}
	if err := s.Validate(); err != nil {
		return err
	}

	switch purpose {
	case ImagePurposeCover:
		if s == ImageVisualStyleNone {
			return fmt.Errorf("cover image visual style must not be none")
		}
	case ImagePurposeIllustration:
		if s != ImageVisualStyleNone {
			return fmt.Errorf("illustration image visual style must be none")
		}
	}

	return nil
}
