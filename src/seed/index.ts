/**
 * Seed data for Vulnerable Auction Lab
 *
 * Creates realistic test data across all features:
 * - Users (admin + regular users)
 * - Auctions (active, ended, scheduled) with images
 * - Bids with bid history
 * - Orders at various workflow stages
 * - Notification preferences
 *
 * Usage: npm run seed   (requires npm run build first)
 * Or:    npx tsx src/seed/index.ts
 */

import { query } from '../config/database';
import bcrypt from 'bcrypt';

// ─── Configuration ──────────────────────────────────────────────────────────────

const DEFAULT_PASSWORD = 'password123'; // Intentionally weak for lab
const SALT_ROUNDS = 10;

// Public placeholder images (picsum.photos) — stored as S3 keys in auction_images
// In production these would be real S3 keys; the CDN URL is prepended by the frontend
const PLACEHOLDER_IMAGES: Record<string, string[]> = {
  watches: [
    'seed/watches/rolex-submariner-1.jpg',
    'seed/watches/rolex-submariner-2.jpg',
    'seed/watches/rolex-submariner-3.jpg',
  ],
  art: [
    'seed/art/abstract-painting-1.jpg',
    'seed/art/abstract-painting-2.jpg',
  ],
  electronics: [
    'seed/electronics/macbook-pro-1.jpg',
    'seed/electronics/macbook-pro-2.jpg',
    'seed/electronics/macbook-pro-3.jpg',
  ],
  furniture: [
    'seed/furniture/mid-century-chair-1.jpg',
    'seed/furniture/mid-century-chair-2.jpg',
  ],
  jewelry: [
    'seed/jewelry/diamond-ring-1.jpg',
    'seed/jewelry/diamond-ring-2.jpg',
    'seed/jewelry/diamond-ring-3.jpg',
  ],
  collectibles: [
    'seed/collectibles/vintage-vinyl-1.jpg',
  ],
  cameras: [
    'seed/cameras/leica-m6-1.jpg',
    'seed/cameras/leica-m6-2.jpg',
  ],
  wine: [
    'seed/wine/bordeaux-1982-1.jpg',
  ],
  guitars: [
    'seed/guitars/fender-strat-1.jpg',
    'seed/guitars/fender-strat-2.jpg',
  ],
  sneakers: [
    'seed/sneakers/jordan-1-1.jpg',
    'seed/sneakers/jordan-1-2.jpg',
  ],
};

// ─── Users ──────────────────────────────────────────────────────────────────────

interface SeedUser {
  email: string;
  name: string;
  role: string;
  phone?: string;
  address?: string;
}

const USERS: SeedUser[] = [
  { email: 'admin@auctionlab.com', name: 'Admin User', role: 'admin', phone: '+1-555-0100', address: '100 Admin St, New York, NY 10001' },
  { email: 'alice@example.com', name: 'Alice Johnson', role: 'user', phone: '+1-555-0101', address: '42 Oak Lane, San Francisco, CA 94102' },
  { email: 'bob@example.com', name: 'Bob Smith', role: 'user', phone: '+1-555-0102', address: '88 Maple Ave, Austin, TX 73301' },
  { email: 'charlie@example.com', name: 'Charlie Brown', role: 'user', phone: '+1-555-0103', address: '15 Pine St, Seattle, WA 98101' },
  { email: 'diana@example.com', name: 'Diana Prince', role: 'user', phone: '+1-555-0104', address: '200 Hero Blvd, Washington, DC 20001' },
  { email: 'eve@example.com', name: 'Eve Torres', role: 'user', phone: '+1-555-0105', address: '77 Cedar Rd, Miami, FL 33101' },
  { email: 'frank@example.com', name: 'Frank Castle', role: 'user', phone: '+1-555-0106', address: '333 Justice Way, Chicago, IL 60601' },
  { email: 'grace@example.com', name: 'Grace Hopper', role: 'user', phone: '+1-555-0107', address: '1 Computer Dr, Boston, MA 02101' },
];

// ─── Auctions ───────────────────────────────────────────────────────────────────

interface SeedAuction {
  title: string;
  description: string;
  starting_price: number;
  status: string;
  workflow_state: string;
  created_by_index: number; // index into USERS array
  end_time_offset_days: number; // days from now (negative = past)
  start_time_offset_days?: number; // for scheduled auctions
  image_category: string;
}

const AUCTIONS: SeedAuction[] = [
  // Active auctions (still accepting bids)
  {
    title: 'Rolex Submariner Date — 2023 Model',
    description: 'Pristine condition Rolex Submariner Date ref. 126610LN. Full box and papers included. Crystal clear, no scratches on the case or bracelet. Worn only a handful of times. This is the current production model with the 41mm Oystersteel case and Cerachrom bezel.',
    starting_price: 8500,
    status: 'active',
    workflow_state: 'active',
    created_by_index: 1, // Alice
    end_time_offset_days: 3,
    image_category: 'watches',
  },
  {
    title: 'Original Abstract Oil Painting — "Midnight Bloom"',
    description: 'Large-scale original abstract oil painting by emerging artist Sofia Reyes. 48x60 inches on gallery-wrapped canvas. Rich blues, deep purples, and gold leaf accents. Comes with certificate of authenticity. Perfect statement piece for a modern living room.',
    starting_price: 1200,
    status: 'active',
    workflow_state: 'active',
    created_by_index: 3, // Charlie
    end_time_offset_days: 5,
    image_category: 'art',
  },
  {
    title: 'MacBook Pro 16" M3 Max — 96GB / 2TB',
    description: 'Apple MacBook Pro 16-inch (2024) with M3 Max chip. 96GB unified memory, 2TB SSD. Space Black finish. AppleCare+ until 2027. Includes original box, charger, and USB-C cable. Battery cycle count: 47. Flawless condition.',
    starting_price: 2800,
    status: 'active',
    workflow_state: 'active',
    created_by_index: 7, // Grace
    end_time_offset_days: 2,
    image_category: 'electronics',
  },
  {
    title: 'Herman Miller Eames Lounge Chair & Ottoman',
    description: 'Authentic Herman Miller Eames Lounge Chair (670) and Ottoman (671). Santos Palisander veneer with black MCL leather. Manufactured 2019. Excellent condition with minor patina on armrests. Includes original Herman Miller authentication tag.',
    starting_price: 3500,
    status: 'active',
    workflow_state: 'active',
    created_by_index: 4, // Diana
    end_time_offset_days: 7,
    image_category: 'furniture',
  },
  {
    title: '2.5 Carat Diamond Engagement Ring — Tiffany Setting',
    description: 'Stunning 2.5 carat round brilliant diamond set in a platinum Tiffany-style 6-prong setting. GIA certified: Color G, Clarity VS1, Excellent cut. Comes with original GIA certificate and appraisal ($28,000). Ring size 6.5, can be resized.',
    starting_price: 15000,
    status: 'active',
    workflow_state: 'active',
    created_by_index: 5, // Eve
    end_time_offset_days: 10,
    image_category: 'jewelry',
  },

  // Auctions ending very soon (creates urgency)
  {
    title: 'Rare First Press Beatles "White Album" Vinyl LP',
    description: 'Original 1968 first UK pressing of The Beatles "White Album" (Apple PMC 7067). Low serial number (#0024891). Includes all four photos, poster, and lyric sheet. Vinyl grades VG+, sleeve grades VG. A true collector\'s grail.',
    starting_price: 500,
    status: 'active',
    workflow_state: 'active',
    created_by_index: 2, // Bob
    end_time_offset_days: 0.25, // 6 hours from now
    image_category: 'collectibles',
  },

  // Ended auctions with various workflow states
  {
    title: 'Leica M6 Classic — Black Chrome',
    description: 'Leica M6 Classic 0.72x viewfinder in black chrome finish. Serial number 2434xxx (1997 production). Meter works perfectly, shutter speeds accurate. Vulcanite is intact. Light brassing on corners adds character. Includes original Leica body cap.',
    starting_price: 2200,
    status: 'ended',
    workflow_state: 'pending_sale',
    created_by_index: 1, // Alice
    end_time_offset_days: -2,
    image_category: 'cameras',
  },
  {
    title: 'Château Lafite Rothschild 1982 — Original Wood Case',
    description: 'Six bottles of Château Lafite Rothschild 1982, Pauillac. Robert Parker 100 points. Provenance: purchased on release from Berry Bros & Rudd, stored in professional wine storage (55°F) since. Original wood case with branded lid. Fill levels all high-shoulder or better.',
    starting_price: 12000,
    status: 'ended',
    workflow_state: 'shipping',
    created_by_index: 6, // Frank
    end_time_offset_days: -5,
    image_category: 'wine',
  },
  {
    title: '1963 Fender Stratocaster — Sunburst',
    description: 'Pre-CBS 1963 Fender Stratocaster in original 3-tone sunburst. All original electronics, pickups, tuners, and tremolo. Original hardshell case included. Neck date: 4/63. Weight: 7.4 lbs. Plays and sounds incredible. Verified by Gruhn Guitars.',
    starting_price: 25000,
    status: 'ended',
    workflow_state: 'complete',
    created_by_index: 3, // Charlie
    end_time_offset_days: -14,
    image_category: 'guitars',
  },

  // Scheduled auction (starts in the future)
  {
    title: 'Nike Air Jordan 1 Retro High OG "Chicago" — DS Size 10',
    description: 'Brand new, deadstock Nike Air Jordan 1 Retro High OG "Chicago" (2024 reissue). Size 10 US. Never tried on. Includes original box with lid, tissue paper, and extra laces. The most iconic sneaker colorway ever produced.',
    starting_price: 250,
    status: 'scheduled',
    workflow_state: 'active',
    created_by_index: 2, // Bob
    end_time_offset_days: 10,
    start_time_offset_days: 2, // starts in 2 days
    image_category: 'sneakers',
  },
];

// ─── Bid patterns ───────────────────────────────────────────────────────────────

interface SeedBidPattern {
  auction_index: number;
  bidder_indices: number[]; // indices into USERS
  bid_amounts: number[];
}

const BID_PATTERNS: SeedBidPattern[] = [
  // Rolex — competitive bidding between Bob, Diana, Frank
  { auction_index: 0, bidder_indices: [2, 4, 6, 2, 4, 6, 2], bid_amounts: [8600, 8900, 9200, 9500, 9800, 10100, 10500] },
  // Painting — light bidding between Eve and Grace
  { auction_index: 1, bidder_indices: [5, 7, 5], bid_amounts: [1300, 1450, 1600] },
  // MacBook — Alice and Bob
  { auction_index: 2, bidder_indices: [1, 2, 1, 2], bid_amounts: [2900, 3100, 3300, 3500] },
  // Eames Chair — Frank and Grace
  { auction_index: 3, bidder_indices: [6, 7, 6], bid_amounts: [3600, 3800, 4100] },
  // Diamond Ring — competitive
  { auction_index: 4, bidder_indices: [1, 4, 7, 1, 4], bid_amounts: [15500, 16000, 16800, 17200, 18000] },
  // Beatles vinyl — several bidders, ending soon
  { auction_index: 5, bidder_indices: [4, 5, 6, 7, 4, 5], bid_amounts: [550, 600, 700, 750, 825, 900] },
  // Leica M6 (ended) — Diana won
  { auction_index: 6, bidder_indices: [4, 5, 4, 6, 4], bid_amounts: [2300, 2500, 2700, 2900, 3100] },
  // Wine (ended, shipping) — Grace won
  { auction_index: 7, bidder_indices: [7, 1, 7, 1, 7], bid_amounts: [12500, 13000, 13800, 14200, 15000] },
  // Fender Strat (ended, complete) — Frank won
  { auction_index: 8, bidder_indices: [6, 2, 6, 2, 6], bid_amounts: [26000, 27500, 29000, 30000, 32000] },
];

// ─── Seed runner ────────────────────────────────────────────────────────────────

async function clearData(): Promise<void> {
  console.log('Clearing existing data...');
  // Delete in dependency order
  await query('DELETE FROM disputes');
  await query('DELETE FROM orders');
  await query('DELETE FROM bids');
  try { await query('DELETE FROM auction_images'); } catch { /* table may not exist */ }
  try { await query('DELETE FROM notification_preferences'); } catch { /* table may not exist */ }
  await query('DELETE FROM auctions');
  await query('DELETE FROM users');

  // Reset sequences
  await query('ALTER SEQUENCE users_id_seq RESTART WITH 1');
  await query('ALTER SEQUENCE auctions_id_seq RESTART WITH 1');
  await query('ALTER SEQUENCE bids_id_seq RESTART WITH 1');
  await query('ALTER SEQUENCE orders_id_seq RESTART WITH 1');
  try { await query('ALTER SEQUENCE auction_images_id_seq RESTART WITH 1'); } catch { /* */ }
  try { await query('ALTER SEQUENCE notification_preferences_id_seq RESTART WITH 1'); } catch { /* */ }
  try { await query('ALTER SEQUENCE disputes_id_seq RESTART WITH 1'); } catch { /* */ }
  console.log('Data cleared.');
}

async function seedUsers(): Promise<number[]> {
  console.log('Seeding users...');
  const userIds: number[] = [];
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  for (const user of USERS) {
    const result = await query(
      `INSERT INTO users (email, password, name, role, phone, address)
       VALUES ('${user.email}', '${hashedPassword}', '${user.name}', '${user.role}', ${user.phone ? `'${user.phone}'` : 'NULL'}, ${user.address ? `'${user.address}'` : 'NULL'})
       RETURNING id`
    );
    userIds.push(result.rows[0].id);
  }

  console.log(`  Created ${userIds.length} users (password: ${DEFAULT_PASSWORD})`);
  return userIds;
}

async function seedAuctions(userIds: number[]): Promise<number[]> {
  console.log('Seeding auctions...');
  const auctionIds: number[] = [];
  const now = new Date();

  for (const auction of AUCTIONS) {
    const endTime = new Date(now.getTime() + auction.end_time_offset_days * 24 * 60 * 60 * 1000);
    const createdBy = userIds[auction.created_by_index];
    const createdAt = new Date(endTime.getTime() - 14 * 24 * 60 * 60 * 1000); // created 14 days before end

    let startTimeSql = 'NULL';
    if (auction.start_time_offset_days !== undefined) {
      const startTime = new Date(now.getTime() + auction.start_time_offset_days * 24 * 60 * 60 * 1000);
      startTimeSql = `'${startTime.toISOString()}'`;
    }

    const result = await query(
      `INSERT INTO auctions (title, description, starting_price, current_bid, end_time, status, workflow_state, created_by, created_at, start_time)
       VALUES ('${auction.title.replace(/'/g, "''")}', '${auction.description.replace(/'/g, "''")}', ${auction.starting_price}, ${auction.starting_price}, '${endTime.toISOString()}', '${auction.status}', '${auction.workflow_state}', ${createdBy}, '${createdAt.toISOString()}', ${startTimeSql})
       RETURNING id`
    );
    auctionIds.push(result.rows[0].id);
  }

  console.log(`  Created ${auctionIds.length} auctions`);
  return auctionIds;
}

async function seedImages(auctionIds: number[], userIds: number[]): Promise<void> {
  console.log('Seeding auction images...');
  let imageCount = 0;

  for (let i = 0; i < AUCTIONS.length; i++) {
    const auction = AUCTIONS[i];
    const auctionId = auctionIds[i];
    const uploadedBy = userIds[auction.created_by_index];
    const images = PLACEHOLDER_IMAGES[auction.image_category] || [];

    for (let j = 0; j < images.length; j++) {
      const s3Key = images[j];
      const filename = s3Key.split('/').pop() || 'image.jpg';

      await query(
        `INSERT INTO auction_images (auction_id, uploaded_by, s3_key, original_filename, content_type, file_size, sort_order, is_primary)
         VALUES (${auctionId}, ${uploadedBy}, '${s3Key}', '${filename}', 'image/jpeg', ${Math.floor(Math.random() * 500000) + 100000}, ${j}, ${j === 0 ? 'true' : 'false'})`
      );
      imageCount++;
    }
  }

  console.log(`  Created ${imageCount} auction images`);
}

async function seedBids(auctionIds: number[], userIds: number[]): Promise<Map<number, { bidId: number; userId: number; amount: number }>> {
  console.log('Seeding bids...');
  let bidCount = 0;
  // Track the winning (highest) bid per auction
  const winningBids = new Map<number, { bidId: number; userId: number; amount: number }>();

  for (const pattern of BID_PATTERNS) {
    const auctionId = auctionIds[pattern.auction_index];
    const auctionCreatedAt = new Date();
    auctionCreatedAt.setDate(auctionCreatedAt.getDate() - 12); // bids start 12 days ago

    for (let i = 0; i < pattern.bid_amounts.length; i++) {
      const bidderId = userIds[pattern.bidder_indices[i]];
      const amount = pattern.bid_amounts[i];
      // Space bids out over time
      const bidTime = new Date(auctionCreatedAt.getTime() + (i + 1) * 8 * 60 * 60 * 1000); // every 8 hours

      const result = await query(
        `INSERT INTO bids (auction_id, user_id, amount, payment_status, created_at)
         VALUES (${auctionId}, ${bidderId}, ${amount}, 'pending', '${bidTime.toISOString()}')
         RETURNING id`
      );

      // Update auction current_bid
      await query(`UPDATE auctions SET current_bid = ${amount} WHERE id = ${auctionId}`);

      winningBids.set(auctionId, { bidId: result.rows[0].id, userId: bidderId, amount });
      bidCount++;
    }
  }

  console.log(`  Created ${bidCount} bids across ${BID_PATTERNS.length} auctions`);
  return winningBids;
}

async function seedOrders(
  auctionIds: number[],
  userIds: number[],
  winningBids: Map<number, { bidId: number; userId: number; amount: number }>
): Promise<void> {
  console.log('Seeding orders...');
  let orderCount = 0;

  // Leica M6 (index 6) — pending_sale, order created but not shipped
  const leica = winningBids.get(auctionIds[6]);
  if (leica) {
    const sellerId = userIds[AUCTIONS[6].created_by_index];
    await query(`UPDATE auctions SET winner_id = ${leica.userId}, closed_at = NOW() - INTERVAL '2 days' WHERE id = ${auctionIds[6]}`);
    await query(
      `INSERT INTO orders (auction_id, buyer_id, seller_id, winning_bid_id, total_amount, payment_status, shipping_status, status, shipping_address, created_at)
       VALUES (${auctionIds[6]}, ${leica.userId}, ${sellerId}, ${leica.bidId}, ${leica.amount}, 'paid', 'pending', 'paid', '${USERS[leica.userId - 1]?.address?.replace(/'/g, "''") || '123 Main St'}', NOW() - INTERVAL '1 day')`
    );
    orderCount++;
  }

  // Wine (index 7) — shipping, has tracking number
  const wine = winningBids.get(auctionIds[7]);
  if (wine) {
    const sellerId = userIds[AUCTIONS[7].created_by_index];
    await query(`UPDATE auctions SET winner_id = ${wine.userId}, closed_at = NOW() - INTERVAL '5 days' WHERE id = ${auctionIds[7]}`);
    await query(
      `INSERT INTO orders (auction_id, buyer_id, seller_id, winning_bid_id, total_amount, payment_status, shipping_status, status, shipping_address, tracking_number, tracking_url, shipped_at, created_at)
       VALUES (${auctionIds[7]}, ${wine.userId}, ${sellerId}, ${wine.bidId}, ${wine.amount}, 'paid', 'shipped', 'shipped', '${USERS[wine.userId - 1]?.address?.replace(/'/g, "''") || '456 Oak Ave'}', '1Z999AA10123456784', 'https://www.ups.com/track?tracknum=1Z999AA10123456784', NOW() - INTERVAL '2 days', NOW() - INTERVAL '4 days')`
    );
    orderCount++;
  }

  // Fender Strat (index 8) — complete
  const guitar = winningBids.get(auctionIds[8]);
  if (guitar) {
    const sellerId = userIds[AUCTIONS[8].created_by_index];
    await query(`UPDATE auctions SET winner_id = ${guitar.userId}, closed_at = NOW() - INTERVAL '14 days' WHERE id = ${auctionIds[8]}`);
    await query(
      `INSERT INTO orders (auction_id, buyer_id, seller_id, winning_bid_id, total_amount, payment_status, shipping_status, status, shipping_address, tracking_number, tracking_url, shipped_at, completed_at, created_at)
       VALUES (${auctionIds[8]}, ${guitar.userId}, ${sellerId}, ${guitar.bidId}, ${guitar.amount}, 'paid', 'delivered', 'completed', '${USERS[guitar.userId - 1]?.address?.replace(/'/g, "''") || '789 Elm St'}', '1Z999AA10987654321', 'https://www.ups.com/track?tracknum=1Z999AA10987654321', NOW() - INTERVAL '10 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '13 days')`
    );
    orderCount++;
  }

  console.log(`  Created ${orderCount} orders`);
}

async function seedNotificationPreferences(userIds: number[]): Promise<void> {
  console.log('Seeding notification preferences...');
  let prefCount = 0;

  for (let i = 0; i < userIds.length; i++) {
    const user = USERS[i];
    // Admin + first few users get all notifications; later users have some disabled
    const allEnabled = i < 4;

    await query(
      `INSERT INTO notification_preferences (user_id, outbid_email, outbid_sms, auction_end_email, auction_end_sms, order_update_email, order_update_sms, phone_number)
       VALUES (${userIds[i]}, true, ${allEnabled}, true, false, true, ${allEnabled}, ${user.phone ? `'${user.phone}'` : 'NULL'})
       ON CONFLICT (user_id) DO NOTHING`
    );
    prefCount++;
  }

  console.log(`  Created ${prefCount} notification preferences`);
}

async function seedDispute(auctionIds: number[], userIds: number[]): Promise<void> {
  console.log('Seeding disputes...');

  // One open dispute on the wine auction (index 7) — buyer claims missing bottle
  const wineAuctionId = auctionIds[7];
  const buyerId = userIds[7]; // Grace (won the wine)

  await query(
    `INSERT INTO disputes (auction_id, filed_by, filed_by_role, reason, status, created_at)
     VALUES (${wineAuctionId}, ${buyerId}, 'buyer', 'Received 5 bottles instead of 6. One bottle appears to be missing from the case. The wooden case has an empty slot. Requesting partial refund or replacement bottle.', 'open', NOW() - INTERVAL '1 day')`
  );

  console.log('  Created 1 dispute');
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  console.log('=== Auction Lab Seed Data ===\n');

  try {
    await clearData();
    const userIds = await seedUsers();
    const auctionIds = await seedAuctions(userIds);
    await seedImages(auctionIds, userIds);
    const winningBids = await seedBids(auctionIds, userIds);
    await seedOrders(auctionIds, userIds, winningBids);
    await seedNotificationPreferences(userIds);
    await seedDispute(auctionIds, userIds);

    console.log('\n=== Seed complete! ===');
    console.log('\nLogin credentials:');
    console.log('  Admin:  admin@auctionlab.com / password123');
    console.log('  Users:  alice@example.com, bob@example.com, etc. / password123');
    console.log(`\nCreated: ${USERS.length} users, ${AUCTIONS.length} auctions, ${BID_PATTERNS.reduce((sum, p) => sum + p.bid_amounts.length, 0)} bids`);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Seed error:', error);
      process.exit(1);
    });
}

export { seed };
