-- Director call script ("call notes"). Empty text means "use the generated
-- default" (Standby ... / ... GO Cue N). Independent cues keep their script on
-- the cue; a Q-Link call keeps it on the group.
ALTER TABLE cues ADD COLUMN standby_script TEXT NOT NULL DEFAULT '';
ALTER TABLE cues ADD COLUMN go_script TEXT NOT NULL DEFAULT '';
ALTER TABLE cue_groups ADD COLUMN standby_script TEXT NOT NULL DEFAULT '';
ALTER TABLE cue_groups ADD COLUMN go_script TEXT NOT NULL DEFAULT '';
