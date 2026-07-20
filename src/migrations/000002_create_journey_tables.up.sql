CREATE TABLE IF NOT EXISTS journey.journey_requests (
    id UUID PRIMARY KEY,
    departure_city VARCHAR(255) NOT NULL,
    departure_country VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    budget_amount INTEGER NOT NULL,
    budget_currency VARCHAR(3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS journey.journeys (
    id UUID PRIMARY KEY,
    journey_request_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_journeys_journey_request
        FOREIGN KEY (journey_request_id)
        REFERENCES journey.journey_requests(id)
        ON DELETE CASCADE
);
