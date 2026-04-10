// src/store/filterStore.ts
import { create } from 'zustand';

export interface ChargerFilters {
  availability: 'available' | 'all';
  minPower: number;
  maxDistance: number;
}

interface FilterState {
  filters: ChargerFilters;
  showFilterSheet: boolean;
  setFilters: (f: Partial<ChargerFilters>) => void;
  resetFilters: () => void;
  toggleFilterSheet: () => void;
}

const DEFAULT: ChargerFilters = {
  availability: 'all',
  minPower: 0,
  maxDistance: 999,
};

export const useFilterStore = create<FilterState>((set) => ({
  filters: DEFAULT,
  showFilterSheet: false,
  setFilters: (f) => set(s => ({ filters: { ...s.filters, ...f } })),
  resetFilters: () => set({ filters: DEFAULT }),
  toggleFilterSheet: () => set(s => ({ showFilterSheet: !s.showFilterSheet })),
}));