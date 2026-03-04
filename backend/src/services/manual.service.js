import { ManualEntry } from "../models/manual.model.js";

export const saveManualEntry = async (data) => {
  const entry = await ManualEntry.create(data);
  return entry;
};
