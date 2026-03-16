-- Allow multiple activity logs per user per day.
-- The unique constraint (user_id, date) was preventing users from logging
-- more than one workout on the same day.
alter table activity_logs
  drop constraint if exists activity_logs_user_id_date_key;
