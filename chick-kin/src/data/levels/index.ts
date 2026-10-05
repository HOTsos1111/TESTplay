import type { LevelDef } from '../../sim/types';
import { CH1 } from './ch1';
import { CH2 } from './ch2';
import { CH3 } from './ch3';

export const LEVELS: LevelDef[] = [...CH1, ...CH2, ...CH3];
export const levelById = (id: string) => LEVELS.find((l) => l.id === id);
