const XLSX = require("xlsx");
const GarageServiceCatalog = require("../models/GarageServiceCatalog.model");
const Inventory = require("../models/Inventry.model");
const asyncHandler = require("../utils/asyncHandler");
const { sendError, sendSuccess } = require("../utils/response.utils");

const normalizeText = (value) => (value ?? "").toString().trim();

const parseCsvList = (value) =>
  normalizeText(value)
    .split(",")
    .map((v) => normalizeText(v))
    .filter(Boolean);

const getGarageIdFromUser = (req) => req.user?.garage || req.body?.garageId;

const buildApplicabilityQuery = ({ brand, model }) => {
  const orConditions = [{ applicability: "generic" }];
  const specificAnd = [{ applicability: "specific" }];

  if (brand) {
    specificAnd.push({
      applicableBrands: { $elemMatch: { $regex: new RegExp(`^${brand}$`, "i") } },
    });
  }

  if (model) {
    specificAnd.push({
      applicableModels: { $elemMatch: { $regex: new RegExp(`^${model}$`, "i") } },
    });
  }

  if (specificAnd.length > 1) {
    orConditions.push({ $and: specificAnd });
  } else {
    orConditions.push({ applicability: "specific" });
  }

  return { $or: orConditions };
};

const buildInventoryApplicabilityQuery = ({ brand, model }) => {
  const orConditions = [{ applicability: "generic" }];
  const specificAnd = [{ applicability: "specific" }];

  if (brand) {
    specificAnd.push({
      applicableBrands: { $elemMatch: { $regex: new RegExp(`^${brand}$`, "i") } },
    });
  }

  if (model) {
    specificAnd.push({
      applicableModels: { $elemMatch: { $regex: new RegExp(`^${model}$`, "i") } },
    });
  }

  if (specificAnd.length > 1) {
    orConditions.push({ $and: specificAnd });
  } else {
    orConditions.push({ applicability: "specific" });
  }

  return { $or: orConditions };
};

const listCatalogItems = asyncHandler(async (req, res) => {
  const garageId = getGarageIdFromUser(req);
  if (!garageId) return sendError(res, 400, "garageId not found for current user.");

  const {
    itemType,
    search = "",
    category = "",
    brand = "",
    model = "",
    page = 1,
    limit = 100,
  } = req.query;

  if (!["service", "part"].includes(itemType)) {
    return sendError(res, 400, "itemType is required and must be service or part.");
  }

  if (itemType === "part") {
    const query = {
      garageId,
      isActive: true,
    };

    const andConditions = [
      buildInventoryApplicabilityQuery({
        brand: normalizeText(brand),
        model: normalizeText(model),
      }),
    ];

    if (normalizeText(search)) {
      const searchRegex = new RegExp(normalizeText(search), "i");
      andConditions.push({
        $or: [
          { partName: searchRegex },
          { partCode: searchRegex },
          { category: searchRegex },
          { brand: searchRegex },
          { manufacturer: searchRegex },
        ],
      });
    }

    if (normalizeText(category)) {
      query.category = new RegExp(`^${normalizeText(category)}$`, "i");
    }

    query.$and = andConditions;

    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await Promise.all([
      Inventory.find(query).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
      Inventory.countDocuments(query),
    ]);

    const mappedItems = items.map((item) => ({
      _id: item._id,
      itemType: "part",
      name: item.partName,
      no: item.partCode || "",
      category: item.category || "",
      manufacturer: item.manufacturer || item.brand || "",
      mrp: item.sellingPrice || 0,
      purchasePrice: item.purchasePrice || 0,
      stock: item.quantityInHand || 0,
      manageInventory: item.manageInventory ?? true,
      applicability: item.applicability || "generic",
      applicableBrands: item.applicableBrands || [],
      applicableModels: item.applicableModels || [],
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    return sendSuccess(res, 200, "Catalog items fetched successfully.", {
      items: mappedItems,
      pagination: { page: safePage, limit: safeLimit, total },
    });
  }

  const query = {
    garageId,
    itemType,
    isActive: true,
  };

  const andConditions = [
    buildApplicabilityQuery({
      brand: normalizeText(brand),
      model: normalizeText(model),
    }),
  ];

  if (normalizeText(search)) {
    const searchRegex = new RegExp(normalizeText(search), "i");
    andConditions.push({
      $or: [
      { name: searchRegex },
      { no: searchRegex },
      { category: searchRegex },
      ],
    });
  }

  if (normalizeText(category)) {
    query.category = new RegExp(`^${normalizeText(category)}$`, "i");
  }

  if (andConditions.length) {
    query.$and = andConditions;
  }

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const skip = (safePage - 1) * safeLimit;

  const [items, total] = await Promise.all([
    GarageServiceCatalog.find(query).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
    GarageServiceCatalog.countDocuments(query),
  ]);

  return sendSuccess(res, 200, "Catalog items fetched successfully.", {
    items,
    pagination: { page: safePage, limit: safeLimit, total },
  });
});

const createCatalogItem = asyncHandler(async (req, res) => {
  const garageId = getGarageIdFromUser(req);
  if (!garageId) return sendError(res, 400, "garageId not found for current user.");

  const {
    itemType,
    name,
    no = "",
    category = "",
    manufacturer = "",
    mrp = 0,
    purchasePrice = 0,
    stock = 0,
    manageInventory = false,
    applicability = "generic",
    applicableBrands = [],
    applicableModels = [],
  } = req.body;

  if (!["service", "part"].includes(itemType)) {
    return sendError(res, 400, "itemType must be service or part.");
  }
  if (!normalizeText(name)) return sendError(res, 400, "name is required.");

  if (itemType === "part") {
    const normalizedApplicability = applicability === "specific" ? "specific" : "generic";
    const normalizedBrands = (
      Array.isArray(applicableBrands) ? applicableBrands : parseCsvList(applicableBrands)
    )
      .map(normalizeText)
      .filter(Boolean);
    const normalizedModels = (
      Array.isArray(applicableModels) ? applicableModels : parseCsvList(applicableModels)
    )
      .map(normalizeText)
      .filter(Boolean);

    if (
      normalizedApplicability === "specific" &&
      normalizedBrands.length === 0 &&
      normalizedModels.length === 0
    ) {
      return sendError(
        res,
        400,
        "For specific applicability, provide at least one brand or model.",
      );
    }

    const inventoryItem = await Inventory.create({
      garageId,
      supplierId: req.user?._id || null,
      partName: normalizeText(name),
      partCode: normalizeText(no) || null,
      category: normalizeText(category) || "general",
      brand: normalizeText(manufacturer) || null,
      manufacturer: normalizeText(manufacturer) || null,
      quantityInHand: Number(stock) || 0,
      minimumStockLevel: 5,
      purchasePrice: Number(purchasePrice) || 0,
      sellingPrice: Number(mrp) || 0,
      manageInventory: Boolean(manageInventory),
      applicability: normalizedApplicability,
      applicableBrands: normalizedBrands,
      applicableModels: normalizedModels,
      isActive: true,
    });

    const mapped = {
      _id: inventoryItem._id,
      itemType: "part",
      name: inventoryItem.partName,
      no: inventoryItem.partCode || "",
      category: inventoryItem.category || "",
      manufacturer: inventoryItem.manufacturer || inventoryItem.brand || "",
      mrp: inventoryItem.sellingPrice || 0,
      purchasePrice: inventoryItem.purchasePrice || 0,
      stock: inventoryItem.quantityInHand || 0,
      manageInventory: inventoryItem.manageInventory ?? true,
      applicability: inventoryItem.applicability || "generic",
      applicableBrands: inventoryItem.applicableBrands || [],
      applicableModels: inventoryItem.applicableModels || [],
      isActive: inventoryItem.isActive,
      createdAt: inventoryItem.createdAt,
      updatedAt: inventoryItem.updatedAt,
    };

    return sendSuccess(res, 201, "Catalog item created successfully.", { item: mapped });
  }

  const payload = {
    garageId,
    createdBy: req.user?._id || null,
    itemType,
    name: normalizeText(name),
    no: normalizeText(no),
    category: normalizeText(category),
    manufacturer: normalizeText(manufacturer),
    mrp: Number(mrp) || 0,
    purchasePrice: Number(purchasePrice) || 0,
    stock: Number(stock) || 0,
    manageInventory: Boolean(manageInventory),
    applicability: applicability === "specific" ? "specific" : "generic",
    applicableBrands: (Array.isArray(applicableBrands) ? applicableBrands : parseCsvList(applicableBrands)).map(normalizeText).filter(Boolean),
    applicableModels: (Array.isArray(applicableModels) ? applicableModels : parseCsvList(applicableModels)).map(normalizeText).filter(Boolean),
  };

  if (payload.applicability === "specific") {
    const hasBrandOrModel = payload.applicableBrands.length || payload.applicableModels.length;
    if (!hasBrandOrModel) {
      return sendError(
        res,
        400,
        "For specific applicability, provide at least one brand or model.",
      );
    }
  }

  const item = await GarageServiceCatalog.create(payload);
  return sendSuccess(res, 201, "Catalog item created successfully.", { item });
});

const parseUploadRows = (req) => {
  if (!req.file?.buffer) return [];
  const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: "" });
};

const bulkUploadCatalogItems = asyncHandler(async (req, res) => {
  const garageId = getGarageIdFromUser(req);
  if (!garageId) return sendError(res, 400, "garageId not found for current user.");

  const itemType = normalizeText(req.body?.itemType).toLowerCase();
  if (!["service", "part"].includes(itemType)) {
    return sendError(res, 400, "itemType must be service or part.");
  }
  if (!req.file) return sendError(res, 400, "Upload file is required.");

  const rows = parseUploadRows(req);
  if (!rows.length) return sendError(res, 400, "File has no rows.");

  const docs = [];
  const failedRows = [];

  rows.forEach((row, index) => {
    const name = normalizeText(row.name || row.serviceName || row.partName);
    if (!name) {
      failedRows.push({ row: index + 2, reason: "name/serviceName/partName is required" });
      return;
    }

    const applicabilityValue = normalizeText(row.applicability || "generic").toLowerCase();
    const applicability = applicabilityValue === "specific" ? "specific" : "generic";
    const applicableBrands = parseCsvList(row.applicableBrands || row.brands || "");
    const applicableModels = parseCsvList(row.applicableModels || row.models || "");

    if (
      applicability === "specific" &&
      applicableBrands.length === 0 &&
      applicableModels.length === 0
    ) {
      failedRows.push({
        row: index + 2,
        reason: "specific applicability requires applicableBrands or applicableModels",
      });
      return;
    }

    if (itemType === "part") {
      docs.push({
        garageId,
        supplierId: req.user?._id || null,
        partName: name,
        partCode: normalizeText(row.no || row.code || "") || null,
        category: normalizeText(row.category || "") || "general",
        brand: normalizeText(row.manufacturer || row.brand || "") || null,
        manufacturer: normalizeText(row.manufacturer || row.brand || "") || null,
        quantityInHand: Number(row.stock || 0) || 0,
        minimumStockLevel: Number(row.minimumStockLevel || 5) || 5,
        purchasePrice: Number(row.purchasePrice || 0) || 0,
        sellingPrice: Number(row.mrp || row.sellingPrice || 0) || 0,
        manageInventory: ["true", "1", "yes"].includes(
          normalizeText(row.manageInventory).toLowerCase(),
        ),
        applicability,
        applicableBrands,
        applicableModels,
        isActive: true,
      });
      return;
    }

    docs.push({
      garageId,
      createdBy: req.user?._id || null,
      itemType,
      name,
      no: normalizeText(row.no || row.code || ""),
      category: normalizeText(row.category || ""),
      manufacturer: normalizeText(row.manufacturer || ""),
      mrp: Number(row.mrp || 0) || 0,
      purchasePrice: Number(row.purchasePrice || 0) || 0,
      stock: Number(row.stock || 0) || 0,
      manageInventory: ["true", "1", "yes"].includes(
        normalizeText(row.manageInventory).toLowerCase(),
      ),
      applicability,
      applicableBrands,
      applicableModels,
    });
  });

  let insertedCount = 0;
  if (docs.length) {
    const inserted =
      itemType === "part"
        ? await Inventory.insertMany(docs, { ordered: false })
        : await GarageServiceCatalog.insertMany(docs, { ordered: false });
    insertedCount = inserted.length;
  }

  return sendSuccess(res, 200, "Bulk upload completed.", {
    totalRows: rows.length,
    insertedCount,
    failedCount: failedRows.length,
    failedRows,
  });
});

module.exports = {
  listCatalogItems,
  createCatalogItem,
  bulkUploadCatalogItems,
};
