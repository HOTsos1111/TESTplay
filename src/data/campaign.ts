/**
 * The nine-level route home (campaign outline v2). Gameplay level numbers
 * (L01–L09) are separate from the opening story's image numbers.
 */
export interface LevelDef {
  /** 1–9, in play order. */
  id: number;
  code: string;
  district: string;
  title: string;
  boss: string;
  objective: string;
  /** Centre of this level's blank plaque on the 1280×720 level map. */
  map: { x: number; y: number };
  /** Region of the map painting that belongs to this district (ghosted while out of reach). */
  area: { x: number; y: number; w: number; h: number };
  /**
   * Existing chapter that stands in for this level until its own route is
   * built, or null when there is nothing to play yet.
   */
  standIn: number | null;
}

const ROW = [
  { y: 0, h: 262 },
  { y: 262, h: 214 },
  { y: 476, h: 244 },
];
const COL = [
  { x: 0, w: 432 },
  { x: 432, w: 412 },
  { x: 844, w: 436 },
];
const area = (row: number, col: number) => ({ x: COL[col].x, y: ROW[row].y, w: COL[col].w, h: ROW[row].h });

export const LEVELS: LevelDef[] = [
  { id: 1, code: 'L01', district: 'Old Town', title: 'Deli Dash', boss: 'Don Crumb', objective: 'Leave the deli and cross the old-town lanes to the brick arch.', map: { x: 228, y: 199 }, area: area(0, 0), standIn: 1 },
  { id: 2, code: 'L02', district: 'Warehouse District', title: 'Crate Expectations', boss: 'Forklift Frankie', objective: 'Cross the loading yards and slip out past the loading bay.', map: { x: 637, y: 202 }, area: area(0, 1), standIn: 2 },
  { id: 3, code: 'L03', district: 'Waterfront', title: 'Pier Pressure', boss: 'Captain Gull', objective: 'Follow the boardwalk and cross the broken pier.', map: { x: 1056, y: 200 }, area: area(0, 2), standIn: null },
  { id: 4, code: 'L04', district: 'Rail Yards', title: 'Track Tricks', boss: 'Switchback Badger', objective: 'Navigate the tracks and leave through the viaduct gate.', map: { x: 1053, y: 424 }, area: area(1, 2), standIn: null },
  { id: 5, code: 'L05', district: 'Industrial Zone', title: 'Steam Team', boss: 'Boiler Brutus', objective: 'Get past the steam lines to the worksite shortcut.', map: { x: 633, y: 422 }, area: area(1, 1), standIn: null },
  { id: 6, code: 'L06', district: 'Construction Zone', title: 'Raise the Woof', boss: 'Hardhat Hank', objective: 'Climb through the unfinished building to downtown.', map: { x: 228, y: 419 }, area: area(1, 0), standIn: null },
  { id: 7, code: 'L07', district: 'Downtown', title: 'Uptown Underdog', boss: 'Dogcatcher Net-O-Matic', objective: 'Dodge the dogcatcher through the shops to the park gate.', map: { x: 228, y: 654 }, area: area(2, 0), standIn: null },
  { id: 8, code: 'L08', district: 'Nature Park', title: 'Bark and Branch', boss: 'Honkzilla', objective: 'Cross the woodland trails and clear the goose bridge.', map: { x: 636, y: 645 }, area: area(2, 1), standIn: null },
  { id: 9, code: 'L09', district: 'Home Suburbs', title: 'The Last Laugh', boss: 'Squirrel Boss', objective: 'Outsmart Squirrel one last time and get home.', map: { x: 1052, y: 660 }, area: area(2, 2), standIn: null },
];
