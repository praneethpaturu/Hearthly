// In-memory store + seed data. Resets on restart — perfect for a demo.
import { nanoid } from 'nanoid';

export const db = {
  users: new Map(),       // phone -> User
  otps: new Map(),        // phone -> { otp, exp }
  flats: new Map(),       // id -> Flat
  communities: new Map(), // id -> Community
  services: new Map(),    // id -> Service
  orders: new Map(),      // id -> Order
  devices: new Map(),     // id -> Device (smart bin / scanner)
};

export function seed() {
  const community = { id: 'c1', name: 'Prestige Sunrise Park', city: 'Bangalore', pincode: '560103' };
  db.communities.set(community.id, community);

  // Flats with pre-assigned RFID tags
  for (const block of ['A', 'B']) {
    for (const num of ['101', '102', '201', '202']) {
      const id = `flat-${block}${num}`;
      db.flats.set(id, {
        id,
        communityId: community.id,
        block,
        number: num,
        rfidTag: `RFID-${block}${num}`,
        label: `${block}-${num}`,
      });
    }
  }

  // Services catalog
  const services = [
    { id: 'svc-garbage',     type: 'GARBAGE',     name: 'Garbage Pickup',       basePrice: 0,     slaMins: 30,  icon: 'recycling' },
    { id: 'svc-laundry',     type: 'LAUNDRY',     name: 'Laundry Pickup',       basePrice: 19900, slaMins: 60,  icon: 'local_laundry_service' },
    { id: 'svc-carwash',     type: 'CARWASH',     name: 'Car Wash',             basePrice: 29900, slaMins: 90,  icon: 'local_car_wash' },
    { id: 'svc-grocery',     type: 'GROCERY',     name: 'Grocery Pickup/Drop',  basePrice: 9900,  slaMins: 45,  icon: 'shopping_basket' },
    { id: 'svc-maintenance', type: 'MAINTENANCE', name: 'Maintenance Request',  basePrice: 49900, slaMins: 120, icon: 'build' },
  ];
  services.forEach((s) => db.services.set(s.id, s));

  // Demo accounts (fixed phone numbers shown on the login screens)
  db.users.set('+919999900001', {
    id: 'u-resident-1', phone: '+919999900001', name: 'Aarav Sharma',
    role: 'RESIDENT', flatId: 'flat-A101', language: 'EN',
  });
  db.users.set('+919999900002', {
    id: 'u-agent-1', phone: '+919999900002', name: 'Ravi Kumar',
    role: 'AGENT', flatId: null, language: 'EN',
  });
  db.users.set('+919999900003', {
    id: 'u-admin-1', phone: '+919999900003', name: 'Priya Admin',
    role: 'ADMIN', flatId: null, language: 'EN',
  });

  // IoT devices
  const bins = [
    { id: 'bin-block-A', label: 'Block A bin',     fillLevel: 32 },
    { id: 'bin-block-B', label: 'Block B bin',     fillLevel: 58 },
    { id: 'bin-common',  label: 'Common-area bin', fillLevel: 14 },
  ];
  bins.forEach((b) =>
    db.devices.set(b.id, {
      id: b.id, type: 'SMART_BIN', label: b.label, communityId: community.id,
      fillLevel: b.fillLevel, lastSeen: Date.now(), online: true,
    }),
  );
  db.devices.set('scanner-gate', {
    id: 'scanner-gate', type: 'QR_SCANNER', label: 'Main gate scanner',
    communityId: community.id, lastSeen: Date.now(), online: true,
  });
}

export const newId = () => nanoid(10);
