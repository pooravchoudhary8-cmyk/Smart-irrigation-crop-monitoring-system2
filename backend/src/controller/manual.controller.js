import { saveManualEntry } from "../services/manual.service.js";

export const addManualEntry = async (req, res) => {
  try {
    const entry = req.body;

    await saveManualEntry(entry);

    res.status(201).json({
      message: "Manual entry saved"
    });
  } catch (error) {
    res.status(500).json({
      error: "Manual entry failed"
    });
  }
};
