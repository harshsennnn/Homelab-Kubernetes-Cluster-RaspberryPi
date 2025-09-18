// controllers/leadController.js
const leadRepository = require('../repositories/leadRepository');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const axios = require('axios');

// Auth helper (mocked by verifyToken)
const getUserId = (req) => req.user?.id;

// ===========================================================
// BUYER: CREATE REQUIREMENT
// POST /leads/requirements
// ===========================================================
exports.createRequirement = async (req, res) => {
    try {
        const buyerId = getUserId(req);

        if (!buyerId) {
            return res.status(401).json({ message: 'Unauthorized: Missing user ID' });
        }

        await leadRepository.syncUserToLocalDB(buyerId);

        const {
            product_requirement,
            category,
            quantity,
            budget_min,
            budget_max,
            delivery_location,
            buyer_name,
            buyer_phone,
            buyer_email,
            additional_details,
        } = req.body;

        if (!product_requirement?.trim()) {
            return res.status(400).json({
                message: 'product_requirement is required',
            });
        }

        const meta = {
            category,
            budget_min,
            budget_max,
            buyer_name,
            buyer_phone,
            buyer_email,
        };

        const requirementData = {
            id: uuidv4(),
            buyer_id: buyerId,
            product_name: product_requirement,
            details: JSON.stringify({
                description: additional_details || null,
                meta,
            }),
            quantity: quantity || null, // e.g. "100KG", "500 pcs"
            location_preference: delivery_location || null,
            city: delivery_location || null,
            status: 'Open',
        };

        const newRequirement =
            await leadRepository.createRequirement(requirementData);

        return res.status(201).json({
            message: 'Requirement created successfully',
            data: newRequirement,
        });

    } catch (err) {
        console.error('createRequirement error:', err);
        return res.status(500).json({
            message: 'Server Error',
            error: err.message,
        });
    }
};

exports.getRequirementById = async (req, res) => {
    try {
        const { id } = req.params;

        const requirement = await db('requirements')
            .where({ id })
            .first();

        if (!requirement) {
            return res.status(404).json({ message: 'Requirement not found' });
        }

        res.json({
            id: requirement.id,
            product_name: requirement.product_name,
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch requirement' });
    }
};


// ===========================================================
// GET REQUIREMENTS
// - /leads/requirements        → PUBLIC (explicit filters only)
// - /leads/requirements/me     → BUYER (all statuses)
// ===========================================================
exports.getRequirements = async (req, res) => {
    try {
        const userId = getUserId(req);
        const filters = { ...req.query };

        // ✅ Buyer route check (CORRECT)
        if (req.originalUrl.endsWith('/requirements/me')) {
            if (!userId) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            filters.buyer_id = userId;

            // 🔥 buyer ke liye status filter kabhi nahi
            delete filters.status;
        }
        // ✅ Seller / Public
        else {
            if (!filters.status) {
                filters.status = 'Open';
            }
        }

        const requirements = await leadRepository.findRequirements(filters);
        res.json(requirements);

    } catch (err) {
        console.error('getRequirements error:', err);
        res.status(500).json({ message: 'Server Error' });
    }
};




// ===========================================================
// BUYER: UPDATE REQUIREMENT
// PUT /leads/requirements/:id
// ===========================================================
exports.updateRequirement = async (req, res) => {
    try {
        const buyerId = getUserId(req);
        if (!buyerId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { id } = req.params;

        const allowedUpdates = [
            'product_name',
            'details',
            'quantity',
            'location_preference',
            'city',
            'status',
        ];

        const updateData = Object.keys(req.body).reduce((acc, key) => {
            if (allowedUpdates.includes(key)) acc[key] = req.body[key];
            return acc;
        }, {});

        if (!Object.keys(updateData).length) {
            return res.status(400).json({
                message: 'No valid fields provided for update',
            });
        }

        const updatedRequirement =
            await leadRepository.updateRequirement(id, buyerId, updateData);

        if (!updatedRequirement) {
            const exists = await leadRepository.findRequirementById(id);
            return exists
                ? res.status(403).json({ message: 'Forbidden' })
                : res.status(404).json({ message: 'Requirement not found' });
        }

        res.json(updatedRequirement);

    } catch (err) {
        console.error('updateRequirement error:', err);
        res.status(500).json({ message: 'Server Error' });
    }
};

// ===========================================================
// BUYER: DELETE REQUIREMENT
// DELETE /leads/requirements/:id
// ===========================================================
exports.deleteRequirement = async (req, res) => {
    try {
        const buyerId = getUserId(req);
        if (!buyerId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { id } = req.params;
        const deletedCount =
            await leadRepository.removeRequirement(id, buyerId);

        if (!deletedCount) {
            const exists = await leadRepository.findRequirementById(id);
            return exists
                ? res.status(403).json({ message: 'Forbidden' })
                : res.status(404).json({ message: 'Requirement not found' });
        }

        res.status(204).send();

    } catch (err) {
        console.error('deleteRequirement error:', err);
        res.status(500).json({ message: 'Server Error' });
    }
};

// ===========================================================
// SELLER: ACCEPT / BUY LEAD (MULTI-SELLER CORRECT)
// ===========================================================
exports.buyLead = async (req, res) => {
  const trx = await db.transaction();

  try {
    const sellerId = req.headers['x-user-id'];
    const { requirementId, message } = req.body;

    // ------------------ VALIDATION ------------------
    if (!sellerId || !requirementId || !message?.trim()) {
      await trx.rollback();
      return res.status(400).json({
        message: 'sellerId, requirementId and message are required',
      });
    }

    // ------------------ FETCH REQUIREMENT ------------------
    const requirement = await trx('requirements')
      .where({ id: requirementId })
      .first();

    if (!requirement) {
      await trx.rollback();
      return res.status(404).json({
        message: 'Requirement not found',
      });
    }

    // ❌ Block only if buyer already closed deal
    if (requirement.status === 'Closed') {
      await trx.rollback();
      return res.status(409).json({
        message: 'Requirement already closed by buyer',
      });
    }

    // ------------------ FETCH SELLER FROM USER-SERVICE ------------------
    let seller;
    try {
      const sellerRes = await axios.get(
        `http://user-service:5006/users/${sellerId}`,
        { timeout: 5000 }
      );
      seller = sellerRes.data;
    } catch (err) {
      await trx.rollback();
      return res.status(404).json({
        message: 'Seller not found in user service',
      });
    }

    if (!seller || seller.role !== 'seller') {
      await trx.rollback();
      return res.status(403).json({
        message: 'Invalid seller account',
      });
    }

    // ------------------ PREVENT SAME SELLER DUPLICATE ------------------
    const alreadyAccepted = await trx('leads')
      .where({
        seller_id: sellerId,
        requirement_id: requirementId,
      })
      .first();

    if (alreadyAccepted) {
      await trx.rollback();
      return res.status(409).json({
        message: 'You have already contacted this buyer',
      });
    }

    // ==================================================
    // 🔥 FIX: MARK REQUIREMENT AS PROCESSING
    // ==================================================
    await trx('requirements')
      .where({ id: requirementId })
      .update({
        status: 'Processing',
        updated_at: trx.fn.now(),
      });

    // ------------------ CREATE LEAD ------------------
    const leadId = uuidv4();

    await trx('leads').insert({
      id: leadId,
      seller_id: sellerId,
      requirement_id: requirementId,
      buyer_id: requirement.buyer_id,
      status: 'Processing',
      created_at: trx.fn.now(),
      updated_at: trx.fn.now(),
    });

    // ------------------ SEND FIRST CHAT MESSAGE ------------------
    await axios.post(
      'http://chat-service:5008/messages',
      {
        sender: sellerId,
        recipient: requirement.buyer_id,
        message,
        requirementId,

        // 🔥 denormalized (future-proof)
        requirementName: requirement.product_name,
        sellerName: seller.name,
      },
      { timeout: 15000 }
    );

    await trx.commit();

    return res.json({
      message: 'Lead accepted & message sent',
      leadId,
    });

  } catch (err) {
    await trx.rollback();
    console.error('[BUY LEAD ERROR]', err);
    return res.status(500).json({
      message: 'Failed to accept lead',
    });
  }
};






// ===========================================================
// SELLER: DASHBOARD STATS
// GET /leads/seller/stats
// ===========================================================
exports.getSellerLeadsStats = async (req, res) => {
    try {
        const sellerId = req.headers['x-user-id'];
        if (!sellerId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const stats =
            await leadRepository.getSellerLeadStats(sellerId);

        res.json(stats);

    } catch (err) {
        console.error('getSellerLeadsStats error:', err);
        res.status(500).json({ message: 'Server Error' });
    }
};

// ===========================================================
// SELLER: CONTACTED LEADS
// GET /leads/seller/contacted
// ===========================================================
exports.getSellerContactedRequirements = async (req, res) => {
    try {
        const sellerId = getUserId(req);
        if (!sellerId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const leads =
            await leadRepository.findContactedRequirementsBySeller(sellerId);

        res.json(leads);

    } catch (err) {
        console.error('getSellerContactedRequirements error:', err);
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.deleteAllRequirements = async (req, res) => {
    const buyerId = req.headers['x-user-id'];
    if (!buyerId) return res.status(401).json({ message: 'Unauthorized' });

    const deletedCount =
        await leadRepository.removeAllRequirementsByBuyer(buyerId);

    if (!deletedCount) {
        return res.status(404).json({ message: 'No requirements found' });
    }

    return res.status(200).json({
        message: 'All requirements deleted successfully',
        deletedCount
    });
};


// ===========================================================
// BUYER: CLOSE DEAL (FINAL & CORRECT)
// ===========================================================
exports.closeRequirement = async (req, res) => {
    const trx = await db.transaction();

    try {
        const buyerId = getUserId(req);
        const { id } = req.params;

        if (!buyerId) {
            await trx.rollback();
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const requirement = await trx('requirements')
            .where({ id, buyer_id: buyerId, status: 'Processing' })
            .first();

        if (!requirement) {
            await trx.rollback();
            return res.status(404).json({
                message: 'Requirement not found or already closed',
            });
        }

        // 1️⃣ Close requirement
        await trx('requirements')
            .where({ id })
            .update({
                status: 'Closed',
                updated_at: trx.fn.now(),
            });

        // 2️⃣ Close ALL seller leads for this requirement
        await trx('leads')
            .where({ requirement_id: id })
            .update({
                status: 'Closed',
                updated_at: trx.fn.now(),
            });

        await trx.commit();

        res.json({
            message: 'Deal closed successfully',
        });

    } catch (err) {
        await trx.rollback();
        console.error('[CLOSE DEAL ERROR]', err);
        res.status(500).json({
            message: 'Failed to close deal',
        });
    }
};


// ===========================================================
// SELLER: CANCEL LEAD
// PUT /leads/:id/cancel
// ===========================================================
exports.cancelLead = async (req, res) => {
  const trx = await db.transaction();

  try {
    const sellerId = getUserId(req);
    const { id } = req.params; // lead id

    if (!sellerId) {
      await trx.rollback();
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const lead = await trx('leads')
      .where({ id, seller_id: sellerId, status: 'Processing' })
      .first();

    if (!lead) {
      await trx.rollback();
      return res.status(404).json({
        message: 'Lead not found or cannot be cancelled',
      });
    }

    // 1️⃣ Cancel lead
    await trx('leads')
      .where({ id })
      .update({
        status: 'Cancelled',
        updated_at: trx.fn.now(),
      });

    // 2️⃣ Re-open requirement
    await trx('requirements')
      .where({ id: lead.requirement_id })
      .update({
        status: 'Open',
        updated_at: trx.fn.now(),
      });

    await trx.commit();

    res.json({
      message: 'Lead cancelled successfully',
    });

  } catch (err) {
    await trx.rollback();
    console.error('[CANCEL LEAD ERROR]', err);
    res.status(500).json({
      message: 'Failed to cancel lead',
    });
  }
};
