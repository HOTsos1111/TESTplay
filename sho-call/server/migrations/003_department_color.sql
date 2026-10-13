-- Department colour (#RRGGBB). Empty means the standard default for that department.
ALTER TABLE departments ADD COLUMN color TEXT NOT NULL DEFAULT '';
