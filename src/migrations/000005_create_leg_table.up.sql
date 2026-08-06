CREATE TABLE IF NOT EXISTS journey.legs (
    id UUID PRIMARY KEY,
    itinerary_day_id UUID NOT NULL,
    seq INTEGER NOT NULL,                    -- 日内での区間順序（0始まり）
    from_spot_id UUID,                       -- NULL のとき from_label を使う
    from_label VARCHAR(255) NOT NULL DEFAULT '',
    to_spot_id UUID NOT NULL,
    transport_mode VARCHAR(20) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_legs_itinerary_day
        FOREIGN KEY (itinerary_day_id) REFERENCES journey.itinerary_days(id) ON DELETE CASCADE,
    CONSTRAINT fk_legs_from_spot
        FOREIGN KEY (from_spot_id) REFERENCES journey.spots(id) ON DELETE CASCADE,
    CONSTRAINT fk_legs_to_spot
        FOREIGN KEY (to_spot_id) REFERENCES journey.spots(id) ON DELETE CASCADE,
    CONSTRAINT chk_legs_from CHECK (from_spot_id IS NOT NULL OR from_label <> ''),
    CONSTRAINT chk_legs_duration CHECK (duration_minutes > 0),
    CONSTRAINT chk_legs_amount CHECK (amount >= 0)
);
