const multer = require('multer');
const { processSalesFiles } = require('../services/salesDataEngine');
const { processTonsCsvFiles } = require('../services/tonsProcessingEngine');

const uploadSalesDataFiles = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 2,
    fileSize: 20 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (/\.(csv|xlsx|xls)$/i.test(file.originalname || '')) return cb(null, true);
    return cb(Object.assign(new Error('Only CSV, XLS, and XLSX files are supported.'), { status: 400 }));
  },
});

const processSalesDataFiles = (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: 'Upload SO-Manila and Sales-Product_Manila CSV/Excel files.',
      });
    }

    const data = processSalesFiles(files);
    const status = data.validation.errors.length ? 422 : 200;
    return res.status(status).json({
      success: !data.validation.errors.length,
      message: data.validation.errors.length
        ? 'Files processed with blocking validation errors.'
        : 'Sales data processed successfully.',
      data,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Sales data processing failed.',
    });
  }
};

const processTonsFiles = (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: 'Upload at least one CSV file.',
      });
    }

    const data = processTonsCsvFiles(files);
    const status = data.validation.errors.length ? 422 : 200;
    return res.status(status).json({
      success: !data.validation.errors.length,
      message: data.validation.errors.length
        ? 'Tons processing finished with validation errors.'
        : 'Tons processed successfully.',
      data,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Tons processing failed.',
    });
  }
};

module.exports = {
  processTonsFiles,
  processSalesDataFiles,
  uploadSalesDataFiles,
};
