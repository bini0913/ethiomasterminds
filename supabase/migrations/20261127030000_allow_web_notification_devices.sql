-- Browser Firebase tokens use the same device registry as native tokens.
ALTER TABLE public.notification_devices
  DROP CONSTRAINT IF EXISTS notification_devices_platform_check;

ALTER TABLE public.notification_devices
  ADD CONSTRAINT notification_devices_platform_check
  CHECK (platform IN ('android', 'ios', 'web'));
