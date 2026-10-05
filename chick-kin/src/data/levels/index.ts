import type { LevelDef } from '../../sim/types';
import { CH1 } from './ch1';
import { CH2 } from './ch2';
import { CH3 } from './ch3';
import { CH4 } from './ch4';
import { CH5 } from './ch5';

export const LEVELS: LevelDef[] = [...CH1, ...CH2, ...CH3, ...CH4, ...CH5];
export const levelById = (id: string) => LEVELS.find((l) => l.id === id);
