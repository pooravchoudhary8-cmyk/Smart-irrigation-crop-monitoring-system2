import fs from "fs";
import path from "path";

export const writeCSVRow = (fileName, row) => {
  const filePath = path.join(process.cwd(), fileName);
  fs.appendFileSync(filePath, row.join(",") + "\n");
};
