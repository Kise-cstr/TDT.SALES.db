const salesRepEntries = [
  { code: '1Ema', name: 'Emmalyn Moloboco' },
  { code: '1Mrky', name: 'Marky Cabajar' },
  { code: '1Aga', name: 'Michael Angelo Blancia' },
  { code: '1Mldy', name: 'Melody Santos' },
  { code: '1KND', name: 'Karen Dy' },
  { code: '1DLM', name: 'Dan Loren Mendoza' },
  { code: '1Den', name: 'Dennis Espinar' },
  { code: '1Dan', name: 'Daniel Justine Habana' },
  { code: '11ber', name: 'Bernabe Lanzaderas' },
  { code: '11Bry', name: 'Bryan Banadera' }
];

export const normalizeSalesRepCode = value => String(value || '')
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '');

export const salesRepCodeNameMap = new Map(
  salesRepEntries.map(entry => [normalizeSalesRepCode(entry.code), entry.name])
);

export const salesRepRoster = salesRepEntries.map((entry, index) => ({
  id: index + 1,
  code: entry.code,
  normalizedCode: normalizeSalesRepCode(entry.code),
  name: entry.name
}));

export const getSalesRepNameFromCode = code => salesRepCodeNameMap.get(normalizeSalesRepCode(code)) || '';

export const getSalesRepRoster = () => [...salesRepRoster];

