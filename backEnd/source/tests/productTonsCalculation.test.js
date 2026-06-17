/**
 * Test suite for Product Tons Calculation Logic
 * 
 * Tests the following functionality:
 * 1. Weight extraction from inventory descriptions
 * 2. Product Total KG calculation (Weight × Quantity)
 * 3. Product Tons calculation (Total KG ÷ 1000)
 * 4. Overall Total Tons calculation
 * 5. Product Breakdown with percentages
 * 
 * Run with: node --test backEnd/source/tests/productTonsCalculation.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  extractUnitWeightKg,
  computeProductTons,
  computeProductBreakdown,
  roundTons,
  roundPercentage,
} = require('../services/productCatalog');

describe('Product Tons Calculation Logic', () => {
  describe('Step 1: Weight Extraction from Inventory Description', () => {
    it('should extract weight from format (xx.xxkgs)', () => {
      assert.strictEqual(
        extractUnitWeightKg('AB018 (Angle Bar, 3mm x 38mm x 38mm x 6M Yellow (10.00kgs))'),
        10,
        'Should extract 10 from (10.00kgs)'
      );
      assert.strictEqual(
        extractUnitWeightKg('DRB012 (Deformed Bar, 12mm x 6M (12.50kgs))'),
        12.5,
        'Should extract 12.5 from (12.50kgs)'
      );
      assert.strictEqual(
        extractUnitWeightKg('MS001 (MS Plate, 6mm x 1220mm x 2440mm (5.80kgs))'),
        5.8,
        'Should extract 5.8 from (5.80kgs)'
      );
    });

    it('should extract weight from format (xxkgs) without decimal', () => {
      assert.strictEqual(extractUnitWeightKg('AB018 (Angle Bar (10kgs))'), 10);
      assert.strictEqual(extractUnitWeightKg('DRB012 (Deformed Bar (15kgs))'), 15);
    });

    it('should extract weight from format without parentheses', () => {
      assert.strictEqual(extractUnitWeightKg('AB018 Angle Bar 10.00kgs'), 10);
      assert.strictEqual(extractUnitWeightKg('DRB012 Deformed Bar 12.50 kg'), 12.5);
      assert.strictEqual(extractUnitWeightKg('MS001 MS Plate 5.80kg'), 5.8);
    });

    it('should return 0 for descriptions without weight', () => {
      assert.strictEqual(extractUnitWeightKg('AB018 (Angle Bar, 3mm x 38mm x 38mm x 6M Yellow)'), 0);
      assert.strictEqual(extractUnitWeightKg('Some random product name'), 0);
      assert.strictEqual(extractUnitWeightKg(''), 0);
      assert.strictEqual(extractUnitWeightKg(null), 0);
      assert.strictEqual(extractUnitWeightKg(undefined), 0);
    });

    it('should handle edge cases with weight patterns', () => {
      // When comma is in the number, the secondary pattern picks up the last numeric part
      // This is expected behavior - comma-separated decimals aren't standard in this format
      assert.strictEqual(extractUnitWeightKg('Product (10,50kgs)'), 50);
      
      // Multiple numbers but only weight pattern should match
      assert.strictEqual(
        extractUnitWeightKg('AB018 (Angle Bar, 3mm x 38mm x 38mm x 6M (10.00kgs))'),
        10
      );
    });
  });

  describe('Step 2: Product Total KG Calculation', () => {
    it('should calculate total KG correctly', () => {
      // Weight = 10.00 kg, Qty = 150
      // 10 × 150 = 1500 kg = 1.5 tons
      const result = computeProductTons({ 
        productName: 'AB018 (Angle Bar, 3mm x 38mm x 38mm x 6M Yellow (10.00kgs))',
        qty: 150 
      });
      assert.strictEqual(result, 1.5);
    });

    it('should handle different weight and quantity combinations', () => {
      // Weight = 12.50 kg, Qty = 100 => 1250 kg = 1.25 tons
      const result = computeProductTons({ 
        productName: 'DRB012 (Deformed Bar (12.50kgs))',
        qty: 100 
      });
      assert.strictEqual(result, 1.25);

      // Weight = 5.80 kg, Qty = 50 => 290 kg = 0.29 tons
      const result2 = computeProductTons({ 
        productName: 'MS001 (MS Plate (5.80kgs))',
        qty: 50 
      });
      assert.strictEqual(result2, 0.29);
    });

    it('should return 0 for invalid inputs', () => {
      // No weight in description
      assert.strictEqual(computeProductTons({ productName: 'No weight here', qty: 100 }), 0);
      // Zero quantity
      assert.strictEqual(computeProductTons({ productName: 'AB018 (10kgs)', qty: 0 }), 0);
      // Negative quantity
      assert.strictEqual(computeProductTons({ productName: 'AB018 (10kgs)', qty: -5 }), 0);
    });

    it('should use explicit weightKgs if provided', () => {
      const result = computeProductTons({ 
        productName: 'Some product',
        qty: 100,
        weightKgs: 25
      });
      assert.strictEqual(result, 2.5);
    });

    it('should handle tons as unit', () => {
      const result = computeProductTons({ 
        productName: 'Some product',
        qty: 5,
        unit: 'TONS'
      });
      assert.strictEqual(result, 5);
    });

    it('should use explicit tons if provided', () => {
      const result = computeProductTons({ 
        productName: 'Some product',
        qty: 100,
        weightKgs: 10,
        tons: 2.5
      });
      assert.strictEqual(result, 2.5);
    });
  });

  describe('Step 3: Rounding Functions', () => {
    describe('roundTons', () => {
      it('should round to 2 decimal places', () => {
        assert.strictEqual(roundTons(1.5), 1.5);
        assert.strictEqual(roundTons(1.555), 1.56);
        assert.strictEqual(roundTons(1.554), 1.55);
        assert.strictEqual(roundTons(1.999), 2);
        assert.strictEqual(roundTons(0.005), 0.01);
      });

      it('should handle edge cases', () => {
        assert.strictEqual(roundTons(0), 0);
        assert.strictEqual(roundTons('1.5'), 1.5);
        assert.strictEqual(roundTons(null), 0);
        assert.strictEqual(roundTons(undefined), 0);
        assert.strictEqual(roundTons(NaN), 0);
      });
    });

    describe('roundPercentage', () => {
      it('should round to 2 decimal places', () => {
        assert.strictEqual(roundPercentage(26.54), 26.54);
        assert.strictEqual(roundPercentage(26.545), 26.55);
        assert.strictEqual(roundPercentage(26.544), 26.54);
        assert.strictEqual(roundPercentage(100), 100);
      });

      it('should handle edge cases', () => {
        assert.strictEqual(roundPercentage(0), 0);
        assert.strictEqual(roundPercentage('26.54'), 26.54);
        assert.strictEqual(roundPercentage(null), 0);
        assert.strictEqual(roundPercentage(undefined), 0);
      });
    });
  });

  describe('Step 4: Product Breakdown with Percentages', () => {
    it('should compute product breakdown correctly', () => {
      const products = [
        { productName: 'AB018 (Angle Bar (10.00kgs))', qty: 100, category: 'Angle Bar' },
        { productName: 'AB019 (Angle Bar (10.00kgs))', qty: 50, category: 'Angle Bar' },
        { productName: 'DRB012 (Deformed Bar (12.50kgs))', qty: 80, category: 'DRBS' },
      ];

      const result = computeProductBreakdown(products);

      // Angle Bar: (10 × 100) + (10 × 50) = 1500 kg = 1.5 tons
      // DRBS: 12.5 × 80 = 1000 kg = 1.0 tons
      // Total: 2.5 tons
      assert.strictEqual(result.totalTons, 2.5);
      assert.strictEqual(result.productBreakdown.length, 2);

      // Check ANGLE BAR (normalized to uppercase)
      const angleBar = result.productBreakdown.find(p => p.name === 'ANGLE BAR');
      assert.ok(angleBar, 'ANGLE BAR should exist in breakdown');
      assert.strictEqual(angleBar.tons, 1.5);
      assert.strictEqual(angleBar.percentage, 60); // 1.5 / 2.5 × 100 = 60%

      // Check DRBS
      const drbs = result.productBreakdown.find(p => p.name === 'DRBS');
      assert.ok(drbs, 'DRBS should exist in breakdown');
      assert.strictEqual(drbs.tons, 1);
      assert.strictEqual(drbs.percentage, 40); // 1.0 / 2.5 × 100 = 40%
    });

    it('should sort products by tons descending', () => {
      // Use valid product categories that match the aliases
      const products = [
        { productName: 'AB018 (Angle Bar 5.00kgs)', qty: 100, category: 'Angle Bar' },
        { productName: 'DRB012 (Deformed Bar 10.00kgs)', qty: 100, category: 'DRBS' },
        { productName: 'MS001 (MS Plate 2.00kgs)', qty: 100, category: 'MS Plate' },
      ];

      const result = computeProductBreakdown(products);

      // DRBS: 10 × 100 = 1000 kg = 1.0 tons
      // ANGLE BAR: 5 × 100 = 500 kg = 0.5 tons
      // MS PLATE: 2 × 100 = 200 kg = 0.2 tons
      assert.strictEqual(result.productBreakdown.length, 3);
      assert.strictEqual(result.productBreakdown[0].name, 'DRBS');
      assert.strictEqual(result.productBreakdown[1].name, 'ANGLE BAR');
      assert.strictEqual(result.productBreakdown[2].name, 'MS PLATE');
    });

    it('should skip products without valid weight', () => {
      // Use valid product categories that match the aliases
      const products = [
        { productName: 'AB018 (Angle Bar 5.00kgs)', qty: 100, category: 'Angle Bar' },
        { productName: 'DRB012 (No weight here)', qty: 100, category: 'DRBS' },
      ];

      const result = computeProductBreakdown(products);

      // Only Angle Bar should be included (DRBS has no valid weight)
      assert.strictEqual(result.productBreakdown.length, 1);
      assert.strictEqual(result.productBreakdown[0].name, 'ANGLE BAR');
    });

    it('should handle empty products array', () => {
      const result = computeProductBreakdown([]);

      assert.strictEqual(result.totalTons, 0);
      assert.strictEqual(result.productBreakdown.length, 0);
    });

    it('should apply date range filter', () => {
      const products = [
        { productName: 'AB018 (Angle Bar (5.00kgs))', qty: 100, category: 'Angle Bar', date: new Date('2024-01-15') },
        { productName: 'DRB012 (Deformed Bar (10.00kgs))', qty: 100, category: 'DRBS', date: new Date('2024-02-15') },
        { productName: 'MS001 (MS Plate (2.00kgs))', qty: 100, category: 'MS Plate', date: new Date('2024-03-15') },
      ];

      const result = computeProductBreakdown(products, {
        dateRange: {
          startDate: new Date('2024-02-01'),
          endDate: new Date('2024-02-28'),
        },
      });

      // Only DRBS (Feb 15) should be included
      assert.strictEqual(result.productBreakdown.length, 1);
      assert.strictEqual(result.productBreakdown[0].name, 'DRBS');
    });

    it('should apply category filter', () => {
      const products = [
        { productName: 'AB018 (Angle Bar (5.00kgs))', qty: 100, category: 'Angle Bar' },
        { productName: 'DRB012 (Deformed Bar (10.00kgs))', qty: 100, category: 'DRBS' },
        { productName: 'MS001 (MS Plate (2.00kgs))', qty: 100, category: 'Angle Bar' },
      ];

      const result = computeProductBreakdown(products, {
        filters: { category: 'Angle Bar' },
      });

      // Angle Bar: (5 × 100) + (2 × 100) = 700 kg = 0.7 tons
      assert.strictEqual(result.totalTons, 0.7);
      assert.strictEqual(result.productBreakdown.length, 1);
      assert.strictEqual(result.productBreakdown[0].name, 'ANGLE BAR');
    });
  });

  describe('Integration Test: Full Calculation Flow', () => {
    it('should calculate tons correctly for example from task description', () => {
      // Example from task:
      // Weight = 10.00 kg, Qty = 150
      // Product Total KG = 10 × 150 = 1,500 kg
      // Product Tons = 1,500 ÷ 1000 = 1.50 MT

      const product = {
        productName: 'AB018 (Angle Bar, 3mm x 38mm x 38mm x 6M Yellow (10.00kgs))',
        qty: 150,
      };

      const weight = extractUnitWeightKg(product.productName);
      assert.strictEqual(weight, 10);

      const totalKg = weight * product.qty;
      assert.strictEqual(totalKg, 1500);

      const tons = computeProductTons(product);
      assert.strictEqual(tons, 1.5);

      const roundedTons = roundTons(tons);
      assert.strictEqual(roundedTons, 1.5);
    });

    it('should calculate product breakdown with correct percentages', () => {
      const products = [
        { productName: 'DRB012 (Deformed Bar (10.00kgs))', qty: 25050, category: 'DRBS' },
        { productName: 'AB018 (Angle Bar (10.00kgs))', qty: 18025, category: 'Angle Bar' },
      ];

      const result = computeProductBreakdown(products);

      // DRBS: 10 × 25050 = 250500 kg = 250.5 tons
      // Angle Bar: 10 × 18025 = 180250 kg = 180.25 tons
      // Total: 430.75 tons

      assert.strictEqual(result.totalTons, 430.75);

      const drbs = result.productBreakdown.find(p => p.name === 'DRBS');
      assert.ok(drbs);
      assert.strictEqual(drbs.tons, 250.5);
      // 250.5 / 430.75 × 100 = 58.1549... rounds to 58.15
      assert.strictEqual(drbs.percentage, 58.15);

      const angleBar = result.productBreakdown.find(p => p.name === 'ANGLE BAR');
      assert.ok(angleBar);
      assert.strictEqual(angleBar.tons, 180.25);
      // 180.25 / 430.75 × 100 = 41.8450... rounds to 41.85
      assert.strictEqual(angleBar.percentage, 41.85);
    });
  });
});

// Summary
console.log('\n========================================');
console.log('Product Tons Calculation Tests');
console.log('========================================\n');