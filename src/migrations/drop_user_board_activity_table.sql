-- Migration: Drop user_board_activity table
-- This table was used for board-specific PoW tracking which has been removed
-- Reason: Board-targeted mining feature was deprecated

DROP TABLE IF EXISTS user_board_activity;
