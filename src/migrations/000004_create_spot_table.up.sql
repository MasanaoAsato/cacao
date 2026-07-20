CREATE TABLE IF NOT EXISTS journey.spots (
    id UUID PRIMARY KEY,
    itinerary_day_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    amount INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_spots_itinerary_day
        FOREIGN KEY (itinerary_day_id)
        REFERENCES journey.itinerary_days(id)
        ON DELETE CASCADE
);
