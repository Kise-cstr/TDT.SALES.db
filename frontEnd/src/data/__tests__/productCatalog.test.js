import { calculateTotalTons } from '../productCatalog';

describe('calculateTotalTons', () => {
  it('uses the last valid kg pattern and skips invalid rows', () => {
    const rows = [
      {
        productName: 'AB018 (Angle Bar (10.00kgs)) (12.00kgs)',
        quantity: 2
      },
      {
        productName: 'DRB012 (Deformed Bar (15.00kgs))',
        quantity: 1
      },
      {
        productName: 'NO WEIGHT HERE',
        quantity: 5
      },
      {
        productName: 'BAD ROW',
        quantity: 0
      }
    ];

    expect(calculateTotalTons(rows)).toBeCloseTo((12 * 2 + 15 * 1) / 1000, 6);
  });

  it('returns 0 when nothing is valid', () => {
    expect(calculateTotalTons([
      { productName: 'NO WEIGHT HERE', quantity: 5 },
      { productName: 'Another item', quantity: 0 }
    ])).toBe(0);
  });
});
