-- Platform config: singleton table for runtime-editable pricing constants
-- Replaces hardcoded values in vdm-wizard/server.js calculateEstimate()

CREATE TABLE IF NOT EXISTS platform_config (
  id         int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pricing    jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- Seed with current hardcoded defaults
INSERT INTO platform_config (id, pricing) VALUES (1, '{
  "labour_rate_hr": 25,
  "overtime_multiplier": 1.3,
  "mileage_rate_mi": 1.25,
  "mileage_min_charge": 10,
  "driving_speed_mph": 40,
  "overtime_threshold_hrs": 8,
  "multiday_threshold_hrs": 12,
  "accommodation_per_night": 80,
  "subsistence_per_day": 30,
  "deposit_pct": 0.30,
  "crew_2_volume_threshold": 200,
  "crew_3_volume_threshold": 500,
  "manual_review_volume": 900,
  "default_van_size": "luton",
  "packing_buffers": { "packed": 0, "mostly_packed": 0.1, "partial": 0.2, "unpacked": 0.3 },
  "packing_time_multipliers": { "packed": 1.0, "mostly_packed": 1.15, "partial": 1.30, "unpacked": 1.45 },
  "info_buffer": 0.10,
  "inefficiency_buffer": 0.15,
  "inefficiency_buffer_awkward": 0.20,
  "loading_hours_buffer": 1.20,
  "loading_hours_min": 2.0,
  "multi_stop_extra_hrs": 0.5,
  "stair_rates": [5, 15, 30, 45, 60],
  "long_carry_rates": [10, 20],
  "parking_rates": { "difficult": 15, "city_centre": 25 },
  "sunday_supplement": 10,
  "bank_holiday_supplement": 20,
  "early_start_supplement": 15,
  "disassembly_charge": 10,
  "disassembly_charge_sometimes": 5
}') ON CONFLICT (id) DO NOTHING;
