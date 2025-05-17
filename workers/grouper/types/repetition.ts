import type { RepetitionDBScheme as RepetitionDBSchemeType } from '@hawk.so/types';

export type RepetitionDBScheme = Omit<RepetitionDBSchemeType, 'payload'> & Partial<Pick<RepetitionDBSchemeType, 'payload'>>;
