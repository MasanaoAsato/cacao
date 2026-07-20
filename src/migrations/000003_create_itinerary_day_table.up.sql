CREATE TABLE IF NOT EXISTS journey.itinerary_days (
    id UUID PRIMARY KEY,
    journey_id UUID NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_itinerary_days_journey
        FOREIGN KEY (journey_id)
        REFERENCES journey.journeys(id)
        ON DELETE CASCADE
);
