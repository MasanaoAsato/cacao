ALTER TABLE journey.journey_images
    DROP CONSTRAINT journey_images_visual_style_check,
    ADD CONSTRAINT journey_images_visual_style_check
        CHECK (
            visual_style IS NULL
            OR visual_style IN (
                'none',
                'editorial-photograph',
                'cinematic-photograph',
                'watercolor',
                'gouache',
                'oil-painting',
                'pastel'
            )
        );
