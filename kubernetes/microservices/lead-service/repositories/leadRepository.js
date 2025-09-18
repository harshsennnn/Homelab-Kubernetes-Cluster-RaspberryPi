// repositories/leadRepository.js
const knex = require('../db');
const { v4: uuidv4 } = require('uuid');

/**
 * Helper to extract id from knex returning result.
 * Knex/Postgres often returns [{ id: '...' }] while some DBs/drivers may return ['...'].
 */
function extractIdFromReturning(rows) {
  if (!rows) return null;
  const first = rows[0];
  if (first == null) return null;
  if (typeof first === 'object') {
    // e.g. { id: 'abc' } or { ID: 'abc' }
    return first.id ?? first.ID ?? Object.values(first)[0];
  }
  // scalar like 'abc' or number
  return first;
}

// ==========================================================
// User Syncing (For Foreign Key Constraint on requirements)
// ==========================================================

async function syncUserToLocalDB(userId) {
  // 1. Check if user already exists locally
  const localUser = await knex('users').where({ id: userId }).first();
  if (localUser) {
    return localUser;
  }

  // 2. Insert a mock user 
  const userData = {
    id: userId,
    name: 'Synced Buyer',
    email: `synced_${userId}@example.com`,
    role: 'buyer'
  };

  // 3. Insert the user into the local 'users' table, ignoring if somehow created between checks
  const [syncedUser] = await knex('users')
    .insert(userData)
    .onConflict('id')
    .ignore()
    .returning('*');

  // Return the newly created or fetched user
  return syncedUser || knex('users').where({ id: userId }).first();
}


// ==========================================================
// Requirement Repository Functions (Buyer CRUD)
// ==========================================================

async function createRequirement(requirementData) {
  if (!requirementData || !requirementData.buyer_id) {
    throw new Error('createRequirement requires requirementData with buyer_id');
  }

  // Note: 'id' generation is handled in the controller now.
  const [row] = await knex('requirements')
    .insert(requirementData)
    .returning('*');

  return row;
}

function findRequirements(filters = {}) {
  let query = knex('requirements').select('*');

  if (filters.status) {
    query.whereRaw('LOWER(status) = ?', [filters.status.toLowerCase()]);
  }

  if (filters.buyer_id) {
    query.where({ buyer_id: filters.buyer_id });
  }

  return query;
}

async function updateRequirement(id, buyerId, updateData) {
  const [updatedRow] = await knex('requirements')
    .where({ id, buyer_id: buyerId })
    .update(updateData)
    .returning('*');
  return updatedRow;
}

async function removeRequirement(id, buyerId) {
  return knex('requirements').where({ id, buyer_id: buyerId }).del();
}

// NEW FUNCTION: Updates status without checking buyer_id (Used by buyLead)
async function updateRequirementStatus(id, newStatus) {
  const [updatedRow] = await knex('requirements')
    .where({ id })
    .update({ status: newStatus })
    .returning('*');
  return updatedRow;
}


// ==========================================================
// Existing Lead Functions (Updated for manual ID generation)
// ==========================================================

async function findRequirementById(id) {
  if (!id) return null;
  return knex('requirements')
    .where({ id })
    .first();
}

async function findContactedSellersForRequirement(requirementId) {
  if (!requirementId) return [];
  return knex('requirement_contacted_sellers')
    .where({ requirement_id: requirementId })
    .select('seller_id');
}



// DELETE ALL requirements of a buyer (SAFE)
async function removeAllRequirementsByBuyer(buyerId) {
  if (!buyerId) {
    throw new Error('removeAllRequirementsByBuyer requires buyerId');
  }

  return knex('requirements')
    .where({ buyer_id: buyerId })
    .del(); // returns deleted rows count
}


async function findCategoryByName(name) {
  if (!name) return null;
  return knex('categories').where({ name }).first();
}

async function createCategory(name) {
  if (!name) throw new Error('createCategory requires a name');

  // FIX 2: Generate ID manually as migration does not use auto-increment/uuid_generate_v4
  const newId = uuidv4();

  // Try insert with generated ID
  const inserted = await knex('categories')
    .insert({ id: newId, name })
    .onConflict('name')
    .ignore()
    .returning('id');

  let id = extractIdFromReturning(inserted);
  if (!id) {
    const existing = await findCategoryByName(name);
    id = existing?.id ?? null;
  }

  return { id, name };
}

async function findPlaceholderProduct(sellerId, requirementDetails) {
  if (!sellerId) return null;

  const q = knex('products')
    .where({
      seller_id: sellerId,
      is_lead_placeholder: true,
    });

  // Only add the description LIKE clause if requirementDetails is provided and non-empty
  if (requirementDetails) {
    q.andWhere('description', 'like', `%${requirementDetails}%`);
  }

  return q.first();
}

async function createProduct(productData) {
  if (!productData || !productData.seller_id) {
    throw new Error('createProduct requires productData with seller_id');
  }

  // FIX 3: Generate ID manually for 'products' table if missing       
  if (!productData.id) {
    productData.id = uuidv4();
  }

  const inserted = await knex('products')
    .insert(productData)
    .returning('id');

  const id = extractIdFromReturning(inserted);
  return { id, ...productData };
}

async function findConversation(productId, sellerId, buyerId) {
  if (!productId) return null;

  const conversation = await knex('conversations')
    .where({ product_id: productId })
    .first();

  if (!conversation) return null;

  const participants = await knex('conversation_participants')
    .where({ conversation_id: conversation.id })
    .select('user_id');

  const sellerParticipates = participants.some(p => p.user_id === sellerId);
  const buyerParticipates = participants.some(p => p.user_id === buyerId);

  if (sellerParticipates && buyerParticipates) {
    return { ...conversation, participants: participants.map(p => ({ id: p.user_id })) };
  } else {
    return null;
  }
}

async function createConversation(productId, sellerId, buyerId) {
  if (!productId) throw new Error('createConversation requires productId');

  // FIX 4: Generate ID manually for the 'conversations' table
  const conversationId = uuidv4();

  const inserted = await knex('conversations')
    .insert({ id: conversationId, product_id: productId })
    .returning('id');

  const returnedId = extractIdFromReturning(inserted);
  if (!returnedId) throw new Error('Failed to create conversation');

  // insert participants - ignore duplicates if any
  await knex('conversation_participants')
    .insert([
      { conversation_id: conversationId, user_id: sellerId },
      { conversation_id: conversationId, user_id: buyerId },
    ])
    .onConflict(['conversation_id', 'user_id'])
    .ignore();

  return { id: conversationId, productId, participants: [{ id: sellerId }, { id: buyerId }] };
}

async function createMessage(messageData) {
  if (!messageData || !messageData.conversation_id) {
    throw new Error('createMessage requires messageData with conversation_id');
  }

  // FIX 5: Generate ID manually for the 'messages' table if missing
  if (!messageData.id) {
    messageData.id = uuidv4();
  }

  const inserted = await knex('messages').insert(messageData).returning('id');
  const id = extractIdFromReturning(inserted);
  return { id, ...messageData };
}

async function addContactedSellerToRequirement(requirementId, sellerId) {
  if (!requirementId || !sellerId) {
    throw new Error('addContactedSellerToRequirement requires requirementId and sellerId');
  }

  // use onConflict to avoid unique constraint errors if already inserted
  return knex('requirement_contacted_sellers')
    .insert({
      requirement_id: requirementId,
      seller_id: sellerId,
    })
    .onConflict(['requirement_id', 'seller_id'])
    .ignore();
}

/* ============================================================
   SELLER: DASHBOARD STATS (FINAL & CORRECT)
   ============================================================ */
async function getSellerLeadStats(sellerId) {
  if (!sellerId) {
    return { total: 0, open: 0, accepted: 0 };
  }

  /* 1️⃣ OPEN REQUIREMENTS (GLOBAL MARKETPLACE) */
  const [{ cnt: open = 0 }] = await knex('requirements')
    .where({ status: 'Open' })
    .count('* as cnt');

  /* 2️⃣ ACCEPTED BY THIS SELLER */
  const [{ cnt: accepted = 0 }] = await knex('leads')
    .where({
      seller_id: sellerId,
      status: 'Processing',
    })
    .count('* as cnt');

  return {
    open: Number(open),
    accepted: Number(accepted),
    total: Number(open) + Number(accepted),
  };
}

// NEW FUNCTION: Fetch all leads (requirements) the seller has contacted for the Lead Manager view
async function findContactedRequirementsBySeller(sellerId) {
  if (!sellerId) return [];

  return knex('leads as l')
    .join('requirements as r', 'r.id', 'l.requirement_id')
    .leftJoin('users as u', 'u.id', 'r.buyer_id')
    .where('l.seller_id', sellerId)
    .select(
      'r.id',
      'l.id as lead_id',
      'r.buyer_id',
      'r.product_name',
      'r.details',
      'r.quantity',
      'r.location_preference',
      'r.city',
      'r.status',
      'r.created_at',
      'r.updated_at',
      knex.raw('l.status as lead_status'),
      knex.raw('l.created_at as lead_created_at'),
      knex.raw('u.name as buyer_name'),
      knex.raw('u.email as buyer_email')
    )
    .orderBy('l.created_at', 'desc');
}


module.exports = {
  findRequirementById,
  findContactedSellersForRequirement,
  findCategoryByName,
  createCategory,
  findPlaceholderProduct,
  createProduct,
  findConversation,
  createConversation,
  createMessage,
  addContactedSellerToRequirement,
  getSellerLeadStats,
  // NEW exports
  createRequirement,
  findRequirements,
  updateRequirement,
  removeRequirement,
  updateRequirementStatus, // Added for use in buyLead controller
  syncUserToLocalDB,
  removeAllRequirementsByBuyer,
  findContactedRequirementsBySeller // <-- NEWLY ADDED

};