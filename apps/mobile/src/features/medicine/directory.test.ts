import { describe, expect, it } from 'vitest';

import { medicineCategories, medicineDirectory, searchMedicines } from './directory';

describe('medicine directory', () => {
  it('has unique names and only known categories', () => {
    const names = medicineDirectory.map((m) => m.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    expect(medicineDirectory.every((m) => medicineCategories.includes(m.category) && m.forms.length > 0)).toBe(true);
  });

  it('covers every category', () => {
    for (const category of medicineCategories) expect(searchMedicines('', category).length).toBeGreaterThan(0);
  });

  it('searches by name, use and category', () => {
    expect(searchMedicines('metform', 'All').map((m) => m.name)).toContain('Metformin');
    expect(searchMedicines('TRT', 'All').length).toBeGreaterThan(2);
    expect(searchMedicines('metformin', 'Skin')).toEqual([]);
  });
});
