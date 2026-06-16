const prisma = require('../config/db');

const createLead = async (req, res) => {
  try {

    const {
      customerName,
      contactNumber,
      email,
      leadSource,
      notes,
    } = req.body;

    const lead = await prisma.lead.create({
      data: {
        customerName,
        contactNumber,
        email,
        leadSource,
        notes,
        userId: req.user.id,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Lead created',
      lead,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

const getMyLeads = async (req, res) => {
  try {

    const leads = await prisma.lead.findMany({
      where: {
        userId: req.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(leads);

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

module.exports = {
  createLead,
  getMyLeads,
};