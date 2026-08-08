ALTER TABLE journey.journey_requests
    ADD COLUMN destination_city VARCHAR(255) NOT NULL,
    ADD COLUMN destination_country VARCHAR(255) NOT NULL;
