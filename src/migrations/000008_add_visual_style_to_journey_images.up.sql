ALTER TABLE journey.journey_images
    ADD COLUMN visual_style VARCHAR(40),
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
        ),
    ADD CONSTRAINT journey_images_visual_style_status_check
        CHECK (status = 'ready' OR visual_style IS NULL);
