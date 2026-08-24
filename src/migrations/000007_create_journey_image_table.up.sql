CREATE TABLE journey.journey_images (
    id UUID PRIMARY KEY,
    journey_request_id UUID NOT NULL
        REFERENCES journey.journey_requests(id) ON DELETE CASCADE,
    purpose VARCHAR(20) NOT NULL,
    ordinal SMALLINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    storage_key TEXT,
    media_type VARCHAR(50),
    width INTEGER,
    height INTEGER,
    failure_code VARCHAR(50),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    lease_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    CONSTRAINT journey_images_request_purpose_ordinal_key
        UNIQUE (journey_request_id, purpose, ordinal),
    CHECK (purpose IN ('cover', 'illustration')),
    CHECK (
        (purpose = 'cover' AND ordinal = 1)
        OR (purpose = 'illustration' AND ordinal BETWEEN 1 AND 3)
    ),
    CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
    CHECK (attempt_count BETWEEN 0 AND 3),
    CHECK (
        (
            status = 'pending'
            AND attempt_count BETWEEN 0 AND 2
            AND storage_key IS NULL
            AND media_type IS NULL
            AND width IS NULL
            AND height IS NULL
            AND failure_code IS NULL
            AND lease_until IS NULL
            AND completed_at IS NULL
        )
        OR (
            status = 'processing'
            AND attempt_count BETWEEN 1 AND 3
            AND storage_key IS NULL
            AND media_type IS NULL
            AND width IS NULL
            AND height IS NULL
            AND failure_code IS NULL
            AND lease_until IS NOT NULL
            AND completed_at IS NULL
        )
        OR (
            status = 'ready'
            AND attempt_count BETWEEN 1 AND 3
            AND storage_key IS NOT NULL
            AND media_type IS NOT NULL
            AND width > 0
            AND height > 0
            AND failure_code IS NULL
            AND lease_until IS NULL
            AND completed_at IS NOT NULL
        )
        OR (
            status = 'failed'
            AND attempt_count BETWEEN 1 AND 3
            AND storage_key IS NULL
            AND media_type IS NULL
            AND width IS NULL
            AND height IS NULL
            AND failure_code IS NOT NULL
            AND lease_until IS NULL
            AND completed_at IS NULL
        )
    )
);

CREATE INDEX idx_journey_images_pending
    ON journey.journey_images (created_at, id)
    WHERE status = 'pending';

CREATE INDEX idx_journey_images_expired_processing
    ON journey.journey_images (lease_until, id)
    WHERE status = 'processing';
