// Run with: npx ts-node --esm scripts/fix-missing-bookings.ts
// Or deploy and hit: /api/admin/fix-bookings?wrestler=Gavin%20Hickey&sessions=81e834c9-eb5c-43a8-a3d8-a46b3e7b2f73,2a877916-4f76-4c54-8046-5622f22536c8

const SESSION_IDS = [
  '81e834c9-eb5c-43a8-a3d8-a46b3e7b2f73',
  '2a877916-4f76-4c54-8046-5622f22536c8',
];
const WRESTLER_NAME = 'Gavin Hickey';

console.log(`Fix missing bookings for ${WRESTLER_NAME}`);
console.log(`Session IDs: ${SESSION_IDS.join(', ')}`);
