import { salesRepRoster } from './salesRepCatalog';
import { resolveSalesRepPhoto } from '../utils/salesRepUtils';

const rosterMetrics = [
  { position: 'Sales Representative', accountStatus: 'approved', avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=160&q=80', department: 'Enterprise Sales', leadsGathered: 242, convertedLeads: 74, grossSalesValue: 210000, performance: 98, previousRank: 2 },
  { position: 'Sales Representative', accountStatus: 'approved', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=160&q=80', department: 'Field Sales', leadsGathered: 226, convertedLeads: 68, grossSalesValue: 180000, performance: 93, previousRank: 1 },
  { position: 'Key Account Executive', accountStatus: 'approved', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=160&q=80', department: 'Key Accounts', branch: 'Manila', leadsGathered: 204, convertedLeads: 59, grossSalesValue: 150000, performance: 89, previousRank: 4 },
  { position: 'Enterprise Sales Associate', accountStatus: 'approved', department: 'Enterprise Sales', leadsGathered: 188, convertedLeads: 52, grossSalesValue: 132000, performance: 84, previousRank: 3 },
  { position: 'Retail Sales Representative', accountStatus: 'approved', department: 'Retail Sales', leadsGathered: 176, convertedLeads: 43, grossSalesValue: 118000, performance: 79, previousRank: 6 },
  { position: 'Field Sales Representative', accountStatus: 'approved', department: 'Field Sales', leadsGathered: 162, convertedLeads: 39, grossSalesValue: 104000, performance: 75, previousRank: 5 },
  { position: 'Key Account Executive', accountStatus: 'approved', department: 'Key Accounts', leadsGathered: 149, convertedLeads: 34, grossSalesValue: 94000, performance: 71, previousRank: 8 },
  { position: 'Retail Sales Representative', accountStatus: 'pending', department: 'Retail Sales', leadsGathered: 136, convertedLeads: 29, grossSalesValue: 82000, performance: 67, previousRank: 7 },
  { position: 'Enterprise Sales Associate', accountStatus: 'approved', department: 'Enterprise Sales', leadsGathered: 128, convertedLeads: 24, grossSalesValue: 76000, performance: 61, previousRank: 10 },
  { position: 'Field Sales Representative', accountStatus: 'inactive', department: 'Field Sales', leadsGathered: 118, convertedLeads: 21, grossSalesValue: 68000, performance: 58, previousRank: 9 }
];

export const baseSalesReps = salesRepRoster.map((rep, index) => ({
  id: rep.id,
  code: rep.code,
  normalizedCode: rep.normalizedCode,
  name: rep.name,
  ...rosterMetrics[index],
  avatar: rosterMetrics[index]?.avatar || resolveSalesRepPhoto({ code: rep.code, name: rep.name })
}));
